import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initPopup } from "../popup";
import { installChrome } from "./chrome-mock";

const html = readFileSync(resolve(process.cwd(), "public/popup.html"), "utf8");
const at = "2026-09-20T10:00:00+00:00";
const src = { title: "Wikidata Q1: García", url: "https://www.wikidata.org/wiki/Q1", type: "structured_database" };
const base = {
  name: "García", parts: [{ text: "García", is_particle: false }], scripts: { LATIN: 6 }, primary_script: "LATIN", notes: [] as string[],
  ambiguous: false as boolean, status: "ok", strength: "low", strength_explanation: "Each claim comes from a single source.", provider_errors: [],
  terms: [{ term: "García", claims: [{ claim_type: "name_kind", label: "Kind of name", disagreement: false,
    values: [{ value: "family name", qualifier: null, independent_sources: 1, evidence: [{ source: src, excerpt: "Spanish surname", score: 0.8, retrieved_at: at }] }] }] }],
  sources: [src] as { title: string; url: string; type: string }[],
};
const json = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });
const $ = (id: string) => document.getElementById(id)!;
const flush = () => new Promise((r) => setTimeout(r, 0));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  installChrome();
  document.documentElement.innerHTML = html;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("popup", () => {
  it("looks up a name from the menu, shows what was sent and renders the result with sources", async () => {
    fetchMock.mockImplementation(async () => json(200, base));
    await initPopup(document, "?name=Garc%C3%ADa&from=menu");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/v1/analyze");
    expect(JSON.parse(init.body)).toEqual({ name: "García" });
    expect($("sent-notice").textContent).toContain("Sent to api.test");
    expect($("sent-notice").textContent).toContain("Nothing else from the page");
    expect($("result").textContent).toContain("family name");
    expect($("result").querySelector("a[href='https://www.wikidata.org/wiki/Q1']")).not.toBeNull();
    expect($("result").querySelector(".badge")!.textContent).toBe("Low");
  });

  it("says so when there is insufficient information", async () => {
    fetchMock.mockImplementation(async () => json(200, { ...base, status: "insufficient", strength: "none", terms: [], sources: [] }));
    await initPopup(document, "?name=Zzyzx");
    expect($("result").textContent).toContain("Insufficient reliable information found.");
  });

  it("shows disagreement and ambiguity", async () => {
    const r = structuredClone(base);
    r.terms[0].claims[0].disagreement = true; r.notes = ["Only one part was given."]; r.ambiguous = true;
    fetchMock.mockImplementation(async () => json(200, r));
    await initPopup(document, "?name=Garc%C3%ADa");
    expect($("result").textContent).toContain("Sources disagree");
    expect($("result").textContent).toContain("This name is ambiguous.");
  });

  it("shows a network error with retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fail")).mockResolvedValueOnce(json(200, base));
    await initPopup(document, "?name=Garc%C3%ADa");
    expect($("status").querySelector("[role=alert]")!.textContent).toContain("Could not reach");
    ($("status").querySelector("button") as HTMLButtonElement).click();
    await flush(); await flush();
    expect($("result").textContent).toContain("family name");
  });

  it("shows server validation messages", async () => {
    fetchMock.mockResolvedValue(json(422, { error: { code: "invalid_name", message: "That looks like a URL." } }));
    await initPopup(document, "?name=foo");
    expect($("status").textContent).toContain("That looks like a URL.");
  });

  it("shows an error for empty selection from the menu without calling the API", async () => {
    await initPopup(document, "?error=empty");
    expect($("status").textContent).toContain("No text was selected");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates manual input before calling the API", async () => {
    await initPopup(document, "");
    ($("form") as HTMLFormElement).dispatchEvent(new Event("submit", { cancelable: true }));
    expect($("status").textContent).toContain("No text was selected");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders hostile server text as text, never HTML", async () => {
    const r = structuredClone(base);
    r.name = "<img src=x onerror=alert(1)>"; r.terms[0].claims[0].values[0].evidence[0].excerpt = "<script>alert(1)</script>";
    r.sources = [{ title: "bad", url: "javascript:alert(1)", type: "encyclopedia" }];
    fetchMock.mockImplementation(async () => json(200, r));
    await initPopup(document, "?name=x");
    expect($("result").querySelector("img")).toBeNull();
    expect($("result").querySelector("script")).toBeNull();
    expect($("result").querySelector("a[href^='javascript']")).toBeNull();
  });

  it("history is opt-in, local, and clearable", async () => {
    fetchMock.mockImplementation(async () => json(200, base));
    await initPopup(document, "?name=Garc%C3%ADa");
    expect($("history").children.length).toBe(0);
    const toggle = $("history-toggle") as HTMLInputElement;
    toggle.checked = true; toggle.dispatchEvent(new Event("change"));
    await flush();
    ($("form") as HTMLFormElement).dispatchEvent(new Event("submit", { cancelable: true }));
    await flush(); await flush(); await flush();
    expect($("history").textContent).toContain("García");
    ($("clear-history") as HTMLButtonElement).click();
    await flush(); await flush();
    expect($("history").children.length).toBe(0);
  });

  it("sends feedback and allows deleting it", async () => {
    fetchMock.mockResolvedValueOnce(json(200, base)).mockResolvedValueOnce(json(201, { id: 9, delete_token: "tok" })).mockResolvedValueOnce(json(204, null));
    await initPopup(document, "?name=Garc%C3%ADa");
    (document.querySelector("input[name=useful][value=yes]") as HTMLInputElement).click();
    (document.querySelector("input[name=pron][value=no]") as HTMLInputElement).click();
    document.querySelector("form.feedback")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush(); await flush();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.test/api/v1/feedback");
    expect(JSON.parse(init.body)).toMatchObject({ name: "García", useful: true, pronunciation_correct: false });
    expect($("result").textContent).toContain("Your feedback was saved");
    ($("result").querySelector("button") as HTMLButtonElement).click();
    await flush(); await flush();
    expect(fetchMock.mock.calls[2][1].headers["X-Delete-Token"]).toBe("tok");
    expect($("result").textContent).toContain("deleted");
  });

  it("does not submit empty feedback", async () => {
    fetchMock.mockImplementation(async () => json(200, base));
    await initPopup(document, "?name=Garc%C3%ADa");
    document.querySelector("form.feedback")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector("form.feedback .error")!.textContent).toContain("Answer a question");
  });
});
