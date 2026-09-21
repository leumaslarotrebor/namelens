import { beforeEach, describe, expect, it } from "vitest";
import { addHistory, clearHistory, getHistory, HISTORY_LIMIT, MAX_SELECTION, sanitizeSelection, setHistoryEnabled, webUrl } from "../lib";
import { installChrome } from "./chrome-mock";

describe("sanitizeSelection", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeSelection("  Maria \n\t García  ")).toEqual({ ok: true, name: "Maria García" });
  });
  it("rejects empty and whitespace-only", () => {
    expect(sanitizeSelection("   ")).toEqual({ ok: false, reason: "empty" });
    expect(sanitizeSelection(undefined)).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects selections that are clearly not just a name", () => {
    expect(sanitizeSelection("a".repeat(MAX_SELECTION + 1))).toEqual({ ok: false, reason: "too_long" });
  });
  it("keeps Unicode, accents and apostrophes, and NFC-normalises", () => {
    expect(sanitizeSelection("Jose\u0301 O’Brien")).toEqual({ ok: true, name: "José O’Brien" });
    expect(sanitizeSelection("山田 太郎")).toEqual({ ok: true, name: "山田 太郎" });
  });
  it("strips control and bidi override characters", () => {
    expect(sanitizeSelection("Ma\u0000ria\u202e")).toEqual({ ok: true, name: "Maria" });
  });
});

describe("webUrl", () => {
  it("encodes the name and marks the source", () => {
    expect(webUrl("José & Co", "https://x.test")).toBe("https://x.test/#/analyze?name=Jos%C3%A9%20%26%20Co&src=extension");
  });
});

describe("local history", () => {
  beforeEach(() => { installChrome(); });
  it("stores nothing unless the user opted in", async () => {
    await addHistory("García");
    expect(await getHistory()).toEqual([]);
  });
  it("stores de-duplicated, capped history when enabled, and can be cleared", async () => {
    await setHistoryEnabled(true);
    await addHistory("García"); await addHistory("Siobhán"); await addHistory("García");
    expect((await getHistory()).map((h) => h.name)).toEqual(["García", "Siobhán"]);
    for (let i = 0; i < 20; i++) await addHistory(`Name${i}`);
    expect((await getHistory()).length).toBe(HISTORY_LIMIT);
    await clearHistory();
    expect(await getHistory()).toEqual([]);
  });
});
