import { beforeEach, describe, expect, it } from "vitest";
import { handleMenuClick, MENU_ID, registerMenu } from "../background";
import { installChrome } from "./chrome-mock";

let c: ReturnType<typeof installChrome>["chrome"];
beforeEach(() => { c = installChrome().chrome; });

const click = (over: Partial<chrome.contextMenus.OnClickData> = {}) =>
  ({ menuItemId: MENU_ID, selectionText: "fallback", frameId: 0, editable: false, pageUrl: "https://example.com/private/page", ...over }) as chrome.contextMenus.OnClickData;
const tab = { id: 5, url: "https://example.com/private/page" } as chrome.tabs.Tab;
const openedUrl = () => new URL(c.windows.create.mock.calls[0][0].url);

describe("context menu", () => {
  it("registers the menu item for selections only", () => {
    registerMenu();
    expect(c.contextMenus.create).toHaveBeenCalledWith({ id: MENU_ID, title: "Explore this name with NameLens", contexts: ["selection"] });
  });

  it("injects the content script into the clicked frame, reads the selection and opens the popup", async () => {
    c.tabs.sendMessage.mockResolvedValue({ text: "  Siobhán  " });
    await handleMenuClick(click({ frameId: 3 }), tab);
    expect(c.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 5, frameIds: [3] }, files: ["content.js"] });
    expect(c.tabs.sendMessage).toHaveBeenCalledWith(5, { type: "NAMELENS_GET_SELECTION" }, { frameId: 3 });
    expect(openedUrl().searchParams.get("name")).toBe("Siobhán");
    expect(openedUrl().searchParams.get("from")).toBe("menu");
  });

  it("never puts the page URL or title in what it opens", async () => {
    c.tabs.sendMessage.mockResolvedValue({ text: "García" });
    await handleMenuClick(click(), { ...tab, title: "Secret inbox" });
    const opened = c.windows.create.mock.calls[0][0].url as string;
    expect(opened).not.toContain("example.com");
    expect(opened).not.toContain("Secret");
  });

  it("falls back to Chrome's selectionText when the page cannot be scripted", async () => {
    c.scripting.executeScript.mockRejectedValue(new Error("Cannot access chrome:// URL"));
    await handleMenuClick(click({ selectionText: "García" }), tab);
    expect(openedUrl().searchParams.get("name")).toBe("García");
  });

  it("shows an error state for an empty selection", async () => {
    c.tabs.sendMessage.mockResolvedValue({ text: "" });
    await handleMenuClick(click({ selectionText: "" }), tab);
    expect(openedUrl().searchParams.get("error")).toBe("empty");
    expect(openedUrl().searchParams.get("name")).toBeNull();
  });

  it("refuses a very long selection instead of sending it", async () => {
    c.tabs.sendMessage.mockResolvedValue({ text: "x".repeat(5000) });
    await handleMenuClick(click(), tab);
    expect(openedUrl().searchParams.get("error")).toBe("too_long");
  });

  it("ignores other menu items", async () => {
    await handleMenuClick(click({ menuItemId: "other" }), tab);
    expect(c.windows.create).not.toHaveBeenCalled();
  });

  it("works without a tab (uses selectionText)", async () => {
    await handleMenuClick(click({ selectionText: "Aoife" }), undefined);
    expect(c.scripting.executeScript).not.toHaveBeenCalled();
    expect(openedUrl().searchParams.get("name")).toBe("Aoife");
  });
});
