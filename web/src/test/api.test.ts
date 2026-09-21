import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeName, ApiError, deleteFeedback, sendFeedback } from "../lib/api";
import { isCommonsAudio, safeHref } from "../lib/util";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("posts the name as JSON", async () => {
    const f = vi.fn().mockResolvedValue(json(200, { name: "García" }));
    vi.stubGlobal("fetch", f);
    await analyzeName("García");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/v1/analyze");
    expect(JSON.parse(init.body)).toEqual({ name: "García" });
  });

  it("maps the error envelope to ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(422, { error: { code: "invalid_name", message: "Enter or select a name." } })));
    await expect(analyzeName("")).rejects.toMatchObject({ code: "invalid_name", message: "Enter or select a name.", status: 422 });
  });

  it("turns network failure into a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(analyzeName("x")).rejects.toBeInstanceOf(ApiError);
    await expect(analyzeName("x")).rejects.toMatchObject({ code: "network" });
  });

  it("handles non-JSON error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    await expect(sendFeedback({ name: "x", useful: true })).rejects.toMatchObject({ status: 502 });
  });

  it("sends the delete token header and handles 204", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    await deleteFeedback({ id: 3, delete_token: "t" });
    expect(f.mock.calls[0][1].headers["X-Delete-Token"]).toBe("t");
    expect(f.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("util", () => {
  it("safeHref only allows http(s)", () => {
    expect(safeHref("https://a.example/x")).toBe("https://a.example/x");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("not a url")).toBeUndefined();
  });
  it("isCommonsAudio only allows Wikimedia Commons file paths", () => {
    expect(isCommonsAudio("https://commons.wikimedia.org/wiki/Special:FilePath/A.ogg")).toBe(true);
    expect(isCommonsAudio("https://evil.example/a.ogg")).toBe(false);
  });
});
