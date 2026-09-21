declare const __API_BASE__: string;
declare const __WEB_BASE__: string;

export const API_BASE: string = __API_BASE__;
export const WEB_BASE: string = __WEB_BASE__;
export const MAX_SELECTION = 200;
export const HISTORY_LIMIT = 10;
export const MSG_GET_SELECTION = "NAMELENS_GET_SELECTION";

export type Sanitized = { ok: true; name: string } | { ok: false; reason: "empty" | "too_long" };

/** Client-side cleanup of a selection before anything is sent anywhere. */
export function sanitizeSelection(raw: string | null | undefined): Sanitized {
  // eslint-disable-next-line no-control-regex
  const cleaned = (raw ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/gu, " ").trim();
  if (!cleaned) return { ok: false, reason: "empty" };
  if (cleaned.length > MAX_SELECTION) return { ok: false, reason: "too_long" };
  return { ok: true, name: cleaned.normalize("NFC") };
}

export const REASON_TEXT: Record<string, string> = {
  empty: "No text was selected. Select a name on the page and try again.",
  too_long: `That selection is longer than ${MAX_SELECTION} characters. Select just the name.`,
  no_access: "NameLens cannot read this page. Type the name into the box below instead.",
};

export const webUrl = (name: string, base = WEB_BASE) =>
  `${base}/#/analyze?name=${encodeURIComponent(name)}&src=extension`;

export const popupUrl = (params: Record<string, string>) => {
  const q = new URLSearchParams(params).toString();
  return chrome.runtime.getURL(`popup.html?${q}`);
};

// ---- local, opt-in history (never uploaded) ----
export interface HistoryEntry { name: string; at: string }

export async function historyEnabled(): Promise<boolean> {
  const { historyEnabled = false } = await chrome.storage.local.get("historyEnabled");
  return Boolean(historyEnabled);
}
export const setHistoryEnabled = (v: boolean) => chrome.storage.local.set({ historyEnabled: v });

export async function getHistory(): Promise<HistoryEntry[]> {
  const { history = [] } = await chrome.storage.local.get("history");
  return history as HistoryEntry[];
}
export async function addHistory(name: string): Promise<void> {
  if (!(await historyEnabled())) return;
  const rest = (await getHistory()).filter((h) => h.name !== name);
  await chrome.storage.local.set({ history: [{ name, at: new Date().toISOString() }, ...rest].slice(0, HISTORY_LIMIT) });
}
export const clearHistory = () => chrome.storage.local.remove("history");
