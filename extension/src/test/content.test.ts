import { afterEach, describe, expect, it } from "vitest";
import { getSelectionText } from "../content";

afterEach(() => { document.body.innerHTML = ""; window.getSelection()?.removeAllRanges(); });

describe("getSelectionText", () => {
  it("returns the selected text on the page", () => {
    document.body.innerHTML = "<p id='p'>Hello Maria García today</p>";
    const range = document.createRange();
    const text = document.getElementById("p")!.firstChild!;
    range.setStart(text, 6); range.setEnd(text, 18);
    window.getSelection()!.addRange(range);
    expect(getSelectionText()).toBe("Maria García");
  });

  it("returns the selected part of a text input", () => {
    document.body.innerHTML = "<input id='i' value='Dear Siobhán'>";
    const i = document.getElementById("i") as HTMLInputElement;
    i.focus(); i.setSelectionRange(5, 12);
    expect(getSelectionText()).toBe("Siobhán");
  });

  it("never reads password fields", () => {
    document.body.innerHTML = "<input id='i' type='password' value='hunter2'>";
    const i = document.getElementById("i") as HTMLInputElement;
    i.focus(); i.setSelectionRange(0, 7);
    expect(getSelectionText()).toBe("");
  });

  it("returns empty when nothing is selected", () => {
    expect(getSelectionText()).toBe("");
  });
});
