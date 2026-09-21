import type { AnalyzeResponse, Claim } from "../../web/src/lib/types";
import {
  addHistory, API_BASE, clearHistory, getHistory, historyEnabled, REASON_TEXT, sanitizeSelection,
  setHistoryEnabled, webUrl,
} from "./lib";

type Child = Node | string | null | false;
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Record<string, string | boolean> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false) continue;
    node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) node.append(c); // strings become text nodes, never HTML
  return node;
}

const STRENGTH = { none: "None", low: "Low", moderate: "Moderate" } as const;
const TYPE = { structured_database: "Structured database", encyclopedia: "Encyclopedia", demo_fixture: "Demo data" } as const;
const httpUrl = (u: string) => { try { const p = new URL(u).protocol; return p === "https:" || p === "http:" ? u : null; } catch { return null; } };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) } });
  } catch {
    throw new Error("Could not reach the NameLens server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "The server returned an unexpected response.");
  return body as T;
}

function link(title: string, url: string) {
  const href = httpUrl(url);
  return href ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, title) : el("span", {}, title);
}

function claimRow(c: Claim) {
  const dd = el("dd");
  for (const v of c.values) {
    dd.append(el("div", { class: "value" },
      el("strong", {}, v.value), v.qualifier ? ` (${v.qualifier})` : "",
      el("span", { class: "muted" }, ` · ${v.independent_sources} independent ${v.independent_sources === 1 ? "source" : "sources"}`),
      el("details", {}, el("summary", {}, `Evidence (${v.evidence.length})`),
        el("ul", {}, ...v.evidence.map((e) => el("li", {}, link(e.source.title, e.source.url), ` [${TYPE[e.source.type]}]`,
          el("blockquote", {}, e.excerpt)))))));
  }
  return [el("dt", {}, c.label + (c.disagreement ? " (sources differ)" : "")), dd];
}

export function renderResult(r: AnalyzeResponse): HTMLElement {
  const root = el("article", { "aria-label": `Result for ${r.name}` },
    el("h2", { class: "name", dir: "auto" }, r.name),
    el("p", { class: "muted" }, `${r.parts.length} ${r.parts.length === 1 ? "part" : "parts"}` +
      (r.primary_script ? ` · ${r.primary_script.toLowerCase()} script` : "")));
  if (r.notes.length) root.append(el("div", { class: "notice info", role: "note" },
    el("strong", {}, r.ambiguous ? "This name is ambiguous." : "Notes"), el("ul", {}, ...r.notes.map((n) => el("li", {}, n)))));
  if (r.provider_errors.length) root.append(el("div", { class: "notice warn", role: "status" },
    el("strong", {}, "Some sources could not be reached. "), r.provider_errors.map((e) => e.message).join(" ")));
  root.append(el("p", {}, "Evidence strength: ", el("span", { class: `badge ${r.strength}` }, STRENGTH[r.strength]),
    el("span", { class: "muted" }, ` ${r.strength_explanation}`)));
  if (r.status === "insufficient") {
    root.append(el("div", { class: "empty" }, el("strong", {}, "Insufficient reliable information found."),
      el("p", {}, "No configured source had a matching entry. NameLens does not guess.")));
  } else {
    for (const t of r.terms) {
      root.append(el("h3", { dir: "auto" }, t.term));
      if (t.claims.some((c) => c.disagreement)) root.append(el("p", { class: "notice warn", role: "note" }, "Sources disagree, or the name has more than one use. Both are shown."));
      root.append(el("dl", {}, ...t.claims.flatMap(claimRow)));
    }
    root.append(el("h3", {}, "Sources"), el("ol", {}, ...r.sources.map((s) => el("li", {}, link(s.title, s.url), ` [${TYPE[s.type]}]`))));
  }
  root.append(feedbackForm(r.name), el("p", {}, el("a", { href: webUrl(r.name), target: "_blank", rel: "noopener noreferrer" }, "Open full view in the web app")));
  return root;
}

function radio(name: string, value: string, label: string) {
  return el("label", { class: "opt" }, el("input", { type: "radio", name, value }), ` ${label}`);
}

function feedbackForm(name: string): HTMLElement {
  const form = el("form", { class: "feedback", novalidate: true },
    el("h3", {}, "Feedback"),
    el("fieldset", {}, el("legend", {}, "Was this information useful?"), radio("useful", "yes", "Yes"), radio("useful", "no", "No")),
    el("fieldset", {}, el("legend", {}, "Was the pronunciation correct?"), radio("pron", "yes", "Correct"), radio("pron", "no", "Incorrect")),
    el("label", { for: "sp" }, "Suggested pronunciation (optional)"), el("input", { id: "sp", name: "sp", type: "text", maxlength: "200" }),
    el("label", { for: "sc" }, "Suggest a correction (optional)"), el("textarea", { id: "sc", name: "sc", maxlength: "500" }),
    el("p", { class: "error", role: "alert", hidden: true }),
    el("button", { type: "submit" }, "Send feedback"),
    el("p", { class: "muted" }, `Sends your answers and “${name}” to ${new URL(API_BASE).host}.`));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const yn = (k: string) => (fd.get(k) === null ? null : fd.get(k) === "yes");
    const body = { name, useful: yn("useful"), pronunciation_correct: yn("pron"),
      suggested_pronunciation: String(fd.get("sp") ?? "").trim() || null, suggestion: String(fd.get("sc") ?? "").trim() || null };
    const err = form.querySelector<HTMLElement>(".error")!;
    if (body.useful === null && body.pronunciation_correct === null && !body.suggested_pronunciation && !body.suggestion) {
      err.textContent = "Answer a question or write a correction first."; err.hidden = false; return;
    }
    try {
      const receipt = await api<{ id: number; delete_token: string }>("/feedback", { method: "POST", body: JSON.stringify(body) });
      const done = el("div", {}, el("p", { role: "status" }, "Thanks. Your feedback was saved."));
      const del = el("button", { type: "button" }, "Delete my feedback");
      del.addEventListener("click", async () => {
        try {
          await api(`/feedback/${receipt.id}`, { method: "DELETE", headers: { "X-Delete-Token": receipt.delete_token } });
          done.replaceChildren(el("p", { role: "status" }, "Your feedback was deleted."));
        } catch (e) { done.append(el("p", { role: "alert", class: "error" }, (e as Error).message)); }
      });
      done.append(del);
      form.replaceWith(done);
    } catch (e) { err.textContent = (e as Error).message; err.hidden = false; }
  });
  return form;
}

export async function initPopup(doc: Document = document, search: string = location.search) {
  const $ = <T extends HTMLElement>(id: string) => doc.getElementById(id) as T;
  const params = new URLSearchParams(search);
  const input = $<HTMLInputElement>("name");
  const status = $("status");
  const out = $("result");
  const notice = $("sent-notice");
  $("api-host").textContent = new URL(API_BASE).host;

  async function lookup(raw: string, fromMenu = false) {
    out.replaceChildren();
    const clean = sanitizeSelection(raw);
    if (!clean.ok) { status.replaceChildren(el("p", { class: "notice err", role: "alert" }, REASON_TEXT[clean.reason])); return; }
    input.value = clean.name;
    notice.textContent = `Sent to ${new URL(API_BASE).host}: “${clean.name}”${fromMenu ? " (your selection)" : ""}. Nothing else from the page.`;
    status.replaceChildren(el("p", { role: "status" }, "Looking up…"));
    try {
      const result = await api<AnalyzeResponse>("/analyze", { method: "POST", body: JSON.stringify({ name: clean.name }) });
      status.replaceChildren();
      out.replaceChildren(renderResult(result));
      await addHistory(clean.name);
      await renderHistory();
    } catch (e) {
      const retry = el("button", { type: "button" }, "Try again");
      retry.addEventListener("click", () => void lookup(clean.name, fromMenu));
      status.replaceChildren(el("div", { class: "notice err", role: "alert" }, (e as Error).message, " ", retry));
    }
  }

  async function renderHistory() {
    const enabled = await historyEnabled();
    $<HTMLInputElement>("history-toggle").checked = enabled;
    const list = $("history");
    const items = enabled ? await getHistory() : [];
    list.replaceChildren(...items.map((h) => {
      const b = el("button", { type: "button", class: "linkish" }, h.name);
      b.addEventListener("click", () => void lookup(h.name));
      return el("li", {}, b);
    }));
    $("clear-history").hidden = !enabled && items.length === 0;
  }

  $("form").addEventListener("submit", (e) => { e.preventDefault(); void lookup(input.value); });
  $<HTMLInputElement>("history-toggle").addEventListener("change", async (e) => {
    await setHistoryEnabled((e.target as HTMLInputElement).checked); await renderHistory();
  });
  $("clear-history").addEventListener("click", async () => { await clearHistory(); await renderHistory(); status.replaceChildren(el("p", { role: "status" }, "History cleared.")); });

  await renderHistory();
  const error = params.get("error");
  if (error) status.replaceChildren(el("p", { class: "notice err", role: "alert" }, REASON_TEXT[error] ?? REASON_TEXT.empty));
  else if (params.get("name")) await lookup(params.get("name")!, params.get("from") === "menu");
  else input.focus();
}

if (typeof chrome !== "undefined" && chrome.runtime?.id && typeof document !== "undefined" && document.getElementById("form")) {
  void initPopup();
}
