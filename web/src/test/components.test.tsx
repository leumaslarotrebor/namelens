import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { FeedbackForm } from "../components/FeedbackForm";
import { ResultView } from "../components/ResultView";
import * as api from "../lib/api";
import { disagreeing, insufficient, okResult } from "./fixtures";

beforeEach(() => vi.restoreAllMocks());

describe("AnalyzeForm", () => {
  it("submits the trimmed name", async () => {
    const onSubmit = vi.fn();
    render(<AnalyzeForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Name to look up"), "  Siobhán  ");
    await userEvent.click(screen.getByRole("button", { name: "Look up name" }));
    expect(onSubmit).toHaveBeenCalledWith("Siobhán");
  });

  it("shows an accessible error for empty input and does not submit", async () => {
    const onSubmit = vi.fn();
    render(<AnalyzeForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Look up name" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    expect(screen.getByLabelText("Name to look up")).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects over-long input", async () => {
    render(<AnalyzeForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Name to look up"), "a".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "Look up name" }));
    expect(screen.getByRole("alert")).toHaveTextContent("100 characters");
  });

  it("example chips look the name up and Enter key submits", async () => {
    const onSubmit = vi.fn();
    render(<AnalyzeForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "山田 太郎" }));
    expect(onSubmit).toHaveBeenCalledWith("山田 太郎");
    await userEvent.type(screen.getByLabelText("Name to look up"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("disables the button while busy", () => {
    render(<AnalyzeForm busy onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Looking up…" })).toBeDisabled();
  });
});

describe("ResultView", () => {
  it("shows name, strength, claims, evidence and sources", async () => {
    render(<ResultView result={okResult} />);
    expect(screen.getByRole("heading", { name: "García", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("family name")).toBeInTheDocument();
    expect(screen.getByText("2 independent sources")).toBeInTheDocument();
    const sources = screen.getByRole("heading", { name: "Sources" }).parentElement!;
    expect(within(sources).getByRole("link", { name: /Wikidata Q1/ })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q1");
    await userEvent.click(screen.getAllByText(/Show evidence \(2\)/)[0]);
    expect(screen.getByText("García is a Spanish surname.")).toBeVisible();
  });

  it("labels demo data and regional qualifiers", () => {
    render(<ResultView result={okResult} />);
    expect(screen.getAllByText("Curated demo data").length).toBeGreaterThan(0);
    expect(screen.getByText("(Spain)")).toBeInTheDocument();
  });

  it("explains ambiguity", () => {
    render(<ResultView result={okResult} />);
    expect(screen.getByText("This name is ambiguous.")).toBeInTheDocument();
  });

  it("says so plainly when there is insufficient information", () => {
    render(<ResultView result={insufficient} />);
    expect(screen.getByRole("heading", { name: "Insufficient reliable information found." })).toBeInTheDocument();
    expect(screen.queryByText("Retrieved evidence")).not.toBeInTheDocument();
  });

  it("surfaces disagreement instead of hiding it", () => {
    render(<ResultView result={disagreeing} />);
    expect(screen.getAllByRole("note").some((n) => /Sources disagree/.test(n.textContent ?? ""))).toBe(true);
    expect(screen.getByText("family name")).toBeInTheDocument();
    expect(screen.getByText("given name")).toBeInTheDocument();
  });

  it("reports unreachable sources", () => {
    render(<ResultView result={{ ...insufficient, provider_errors: [{ provider: "wikidata", message: "Wikidata unavailable (ConnectError)." }] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Some sources could not be reached");
  });

  it("does not render links with unsafe protocols", () => {
    const bad = structuredClone(okResult);
    bad.sources = [{ title: "Evil", url: "javascript:alert(1)", type: "encyclopedia" }];
    render(<ResultView result={bad} />);
    expect(screen.queryByRole("link", { name: /Evil/ })).not.toBeInTheDocument();
    expect(screen.getByText("Evil")).toBeInTheDocument();
  });

  it("renders a hostile name as text, not markup", () => {
    render(<ResultView result={{ ...insufficient, name: "<img src=x onerror=alert(1)>", parts: [] }} />);
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("FeedbackForm", () => {
  it("requires some input", async () => {
    const send = vi.spyOn(api, "sendFeedback");
    render(<FeedbackForm name="García" />);
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Answer a question");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends answers, then allows deleting", async () => {
    const send = vi.spyOn(api, "sendFeedback").mockResolvedValue({ id: 7, delete_token: "tok" });
    const del = vi.spyOn(api, "deleteFeedback").mockResolvedValue(undefined);
    render(<FeedbackForm name="Siobhán" />);
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("radio", { name: "Incorrect" }));
    await userEvent.type(screen.getByLabelText(/Suggested pronunciation/), "shi-VAWN");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(send).toHaveBeenCalledWith({ name: "Siobhán", useful: true, pronunciation_correct: false, suggested_pronunciation: "shi-VAWN", suggestion: null });
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks");
    await userEvent.click(screen.getByRole("button", { name: "Delete my feedback" }));
    expect(del).toHaveBeenCalledWith({ id: 7, delete_token: "tok" });
    expect(await screen.findByRole("status")).toHaveTextContent("deleted");
  });

  it("shows server errors accessibly and keeps the form", async () => {
    vi.spyOn(api, "sendFeedback").mockRejectedValue(new api.ApiError("Server is down.", "network"));
    render(<FeedbackForm name="García" />);
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server is down.");
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
  });
});

describe("Analyze page", () => {
  const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><AppRoutes /></MemoryRouter>);

  it("loads a name from the query string and shows the result", async () => {
    const spy = vi.spyOn(api, "analyzeName").mockResolvedValue(okResult);
    renderAt("/analyze?name=Garc%C3%ADa&src=extension");
    expect(screen.getByRole("status")).toHaveTextContent("Looking up");
    expect(await screen.findByRole("heading", { name: "García", level: 2 })).toBeInTheDocument();
    expect(spy.mock.calls[0][0]).toBe("García");
    expect(screen.getByText(/Opened from the NameLens extension/)).toBeInTheDocument();
  });

  it("shows an error with retry for network failures", async () => {
    const spy = vi.spyOn(api, "analyzeName").mockRejectedValueOnce(new api.ApiError("Could not reach the NameLens server.", "network"))
      .mockResolvedValueOnce(okResult);
    renderAt("/analyze?name=Garc%C3%ADa");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "García", level: 2 })).toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("shows validation errors without a retry button", async () => {
    vi.spyOn(api, "analyzeName").mockRejectedValue(new api.ApiError("That looks like a URL.", "invalid_name", 422));
    renderAt("/analyze?name=http%3A%2F%2Fx");
    expect(await screen.findByRole("alert")).toHaveTextContent("That looks like a URL.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows the empty state with no name", () => {
    renderAt("/analyze");
    expect(screen.getByText(/Enter a name above/)).toBeInTheDocument();
  });
});
