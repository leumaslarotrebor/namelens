/**
 * Injected only when the user picks "Explore this name with NameLens" (activeTab).
 * It answers one message with the current selection and does nothing else:
 * no page scraping, no network access, no listeners on page events.
 */
import { MSG_GET_SELECTION } from "./lib";

export function getSelectionText(doc: Document = document, win: Window = window): string {
  const el = doc.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el instanceof HTMLInputElement && el.type === "password") return ""; // never read password fields
    const { selectionStart: s, selectionEnd: e } = el;
    if (s !== null && e !== null && s !== e) return el.value.slice(s, e);
  }
  return win.getSelection()?.toString() ?? "";
}

const flag = "__namelensContentLoaded";
const w = window as unknown as Record<string, unknown>;
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage && !w[flag]) {
  w[flag] = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === MSG_GET_SELECTION) sendResponse({ text: getSelectionText() });
  });
}
