import type { AnalyzeResponse } from "../lib/types";
import { PROVIDER_LABEL } from "../lib/util";

/** Shows what the system actually did for this request, using only fields returned by the API. */
export function Process({ result }: { result: AnalyzeResponse }) {
  const scripts = Object.keys(result.scripts).map((s) => s.charAt(0) + s.slice(1).toLowerCase());
  const failed = new Set(result.provider_errors.map((e) => e.provider));
  const claims = result.terms.flatMap((t) => t.claims).length;
  return (
    <details className="process">
      <summary>How this result was produced</summary>
      <ol>
        <li>
          <strong>Input normalised.</strong>{" "}
          {result.input_changed ? "Unicode form and whitespace were adjusted." : "The text already had a normalised Unicode form and clean spacing."}
        </li>
        <li>
          <strong>Writing system.</strong>{" "}
          {scripts.length ? `Detected: ${scripts.join(", ")}.` : "No letters were recognised."} This is a lightweight check of character properties, not language identification.
        </li>
        <li>
          <strong>Sources queried:</strong>{" "}
          {result.providers_queried.map((p, i) => (
            <span key={p}>{i > 0 && ", "}{PROVIDER_LABEL[p] ?? p}{failed.has(p) ? " (unavailable)" : ""}</span>
          ))}.
        </li>
        <li><strong>Ranked and grouped.</strong> {claims} {claims === 1 ? "claim" : "claims"} from {result.sources.length} {result.sources.length === 1 ? "source" : "sources"}; duplicate records removed.</li>
        <li><strong>Uncertainty assessed.</strong> {result.strength_explanation}</li>
      </ol>
    </details>
  );
}
