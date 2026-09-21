import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { ResultView } from "../components/ResultView";
import { analyzeName, ApiError } from "../lib/api";
import type { AnalyzeResponse } from "../lib/types";
import { useTitle } from "../lib/useTitle";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: AnalyzeResponse }
  | { status: "error"; message: string; retryable: boolean };

export function Analyze() {
  const [params, setParams] = useSearchParams();
  const name = params.get("name") ?? "";
  const fromExtension = params.get("src") === "extension";
  const [state, setState] = useState<State>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  useTitle(name ? `${name}` : "Analyze");

  useEffect(() => {
    if (!name) { setState({ status: "idle" }); return; }
    const controller = new AbortController();
    setState({ status: "loading" });
    analyzeName(name, controller.signal)
      .then((result) => setState({ status: "done", result }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        const api = err instanceof ApiError ? err : null;
        setState({ status: "error", message: api?.message ?? "Something went wrong.", retryable: !api || api.status === 0 || api.status >= 500 });
      });
    return () => controller.abort();
  }, [name, attempt]);

  return (
    <>
      <h1>Analyze a name</h1>
      {fromExtension && (
        <p className="notice info">Opened from the NameLens extension. Only the text you selected was sent.</p>
      )}
      <AnalyzeForm initial={name} busy={state.status === "loading"} showExamples={!name}
        onSubmit={(n) => setParams({ name: n })} />
      <div aria-live="polite">
        {state.status === "loading" && (
          <div role="status">
            <p className="hint">Looking up “{name}” in public sources…</p>
            <div className="skeleton" aria-hidden="true"><span /><span /><span /></div>
          </div>
        )}
        {state.status === "error" && (
          <div className="notice err" role="alert">
            <strong>Could not analyze this name.</strong> {state.message}
            {state.retryable && <div><button type="button" className="btn secondary" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>}
          </div>
        )}
        {state.status === "idle" && (
          <p className="hint">Enter a name above, or select one on any page with the browser extension.</p>
        )}
      </div>
      {state.status === "done" && <ResultView result={state.result} />}
    </>
  );
}
