import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import { ResultView } from "../components/ResultView";
import * as api from "../lib/api";
import { disagreeing, insufficient, okResult } from "./fixtures";

async function violations(container: HTMLElement) {
  const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return res.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

describe("uncertainty and provenance", () => {
  it("shows the process panel using only API-provided facts", async () => {
    render(<ResultView result={{ ...okResult, input_changed: true, provider_errors: [{ provider: "wikipedia", message: "Wikipedia unavailable (ConnectError)." }] }} />);
    await userEvent.click(screen.getByText("How this result was produced"));
    const steps = document.querySelector("details.process ol")!;
    expect(steps.textContent).toContain("Unicode form and whitespace were adjusted");
    expect(steps.textContent).toContain("Detected: Latin");
    expect(steps.textContent).toContain("Wikipedia (unavailable)");
    expect(steps.textContent).toContain("not language identification");
  });

  it("shows an explicit unavailable state when no pronunciation was returned", () => {
    const noPron = structuredClone(okResult);
    noPron.terms[0].claims = noPron.terms[0].claims.filter((c) => c.claim_type !== "pronunciation");
    render(<ResultView result={noPron} />);
    expect(screen.getByText(/No pronunciation information was found/)).toBeInTheDocument();
  });

  it("shows pronunciation only when the backend returned it, as left-to-right IPA", () => {
    render(<ResultView result={okResult} />);
    expect(screen.queryByText(/No pronunciation information was found/)).not.toBeInTheDocument();
    expect(screen.getByText("/ɡaɾˈθi.a/")).toHaveAttribute("dir", "ltr");
    expect(screen.queryByRole("button", { name: /play|listen/i })).not.toBeInTheDocument();
  });

  it("labels curated demo data and does not present it as authoritative", () => {
    render(<ResultView result={okResult} />);
    expect(screen.getByText(/not an authoritative linguistic database/)).toBeInTheDocument();
  });

  it("only offers audio when the backend returns a Wikimedia Commons audio claim", () => {
    const withAudio = structuredClone(okResult);
    withAudio.terms[0].claims.push({ claim_type: "audio", label: "Pronunciation audio", disagreement: false, values: [{
      value: "https://commons.wikimedia.org/wiki/Special:FilePath/Es-Garc%C3%ADa.ogg", qualifier: null, independent_sources: 1,
      evidence: [{ source: okResult.sources[0], excerpt: "audio", score: 0.8, retrieved_at: "2026-09-20T10:00:00+00:00" }] }] });
    const { container } = render(<ResultView result={withAudio} />);
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("states low confidence in words, not colour alone", () => {
    render(<ResultView result={disagreeing} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText(/Confidence and uncertainty/)).toBeInTheDocument();
  });

  it("marks right-to-left names with automatic direction", () => {
    const r = { ...insufficient, name: "محمد بن سلمان", parts: [{ text: "محمد", is_particle: false }, { text: "بن", is_particle: true }], scripts: { ARABIC: 10 }, primary_script: "ARABIC" };
    render(<ResultView result={r} />);
    expect(screen.getByRole("heading", { level: 2, name: r.name })).toHaveAttribute("dir", "auto");
    expect(screen.getByText("particle")).toBeInTheDocument();
  });
});

describe("accessibility (axe-core)", () => {
  it("result with evidence has no violations", async () => {
    const { container } = render(<ResultView result={okResult} />);
    expect(await violations(container)).toEqual([]);
  });
  it("insufficient result has no violations", async () => {
    const { container } = render(<ResultView result={insufficient} />);
    expect(await violations(container)).toEqual([]);
  });
  it("home, sources, privacy and about pages have no violations", async () => {
    vi.spyOn(api, "getSources").mockResolvedValue([{ id: "wikidata", name: "Wikidata", type: "structured_database", url: "https://www.wikidata.org/", enabled: true, description: "d", caveat: "c" }]);
    for (const path of ["/", "/sources", "/privacy", "/about", "/analyze"]) {
      const { container, unmount } = render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
      if (path === "/sources") await screen.findByText("Wikidata");
      expect(await violations(container), path).toEqual([]);
      unmount();
    }
  });
  it("navigation exposes a skip link, landmarks and the current page", () => {
    render(<MemoryRouter initialEntries={["/privacy"]}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Privacy" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main")).toHaveFocus();
  });
  it("home script examples are keyboard-operable buttons", async () => {
    render(<MemoryRouter initialEntries={["/"]}><AppRoutes /></MemoryRouter>);
    const btn = screen.getByRole("button", { name: "சுப்பிரமணியன்" });
    btn.focus();
    expect(btn).toHaveFocus();
    expect(screen.getByRole("table", { name: /Example names by writing system/ })).toBeInTheDocument();
  });
});
