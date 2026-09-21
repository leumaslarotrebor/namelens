import { MSG_GET_SELECTION, popupUrl, sanitizeSelection } from "./lib";

export const MENU_ID = "namelens-explore";

export function registerMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Explore this name with NameLens", contexts: ["selection"] });
  });
}

async function readSelection(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<string> {
  if (tab?.id !== undefined) {
    try {
      const target = { tabId: tab.id, frameIds: [info.frameId ?? 0] };
      await chrome.scripting.executeScript({ target, files: ["content.js"] });
      const res = await chrome.tabs.sendMessage(tab.id, { type: MSG_GET_SELECTION }, { frameId: info.frameId ?? 0 });
      if (typeof res?.text === "string" && res.text.trim()) return res.text;
    } catch {
      /* page not scriptable: fall back to the text Chrome gave us for the click */
    }
  }
  return info.selectionText ?? "";
}

export async function handleMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (info.menuItemId !== MENU_ID) return;
  const clean = sanitizeSelection(await readSelection(info, tab));
  const url = clean.ok ? popupUrl({ name: clean.name, from: "menu" }) : popupUrl({ error: clean.reason });
  await chrome.windows.create({ url, type: "popup", width: 460, height: 760 });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(registerMenu);
  chrome.contextMenus.onClicked.addListener((info, tab) => void handleMenuClick(info, tab));
}
