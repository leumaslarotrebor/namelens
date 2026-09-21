import { useEffect, useState } from "react";
import { getSources } from "../lib/api";
import type { SourceInfo } from "../lib/types";
import { safeHref, TYPE_LABEL } from "../lib/util";
import { useTitle } from "../lib/useTitle";

export function Sources() {
  useTitle("Sources");
  const [sources, setSources] = useState<SourceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getSources().then(setSources).catch((e) => setError(e instanceof Error ? e.message : "Could not load sources."));
  }, []);
  return (
    <>
      <h1>Sources</h1>
      <p>These are the places NameLens looks. Each one has limits, listed below. A name with no entry in any of them gets the answer “Insufficient reliable information found.”</p>
      {error && <p className="notice err" role="alert">{error}</p>}
      {!sources && !error && <p role="status" className="hint">Loading sources…</p>}
      {sources?.map((s) => (
        <section key={s.id} className="source-row" aria-labelledby={`s-${s.id}`}>
          <h2 id={`s-${s.id}`}>
            {safeHref(s.url) ? <a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}{" "}
            <span className={`type-tag ${s.type}`}>{TYPE_LABEL[s.type]}</span>{" "}
            <span className="type-tag">{s.enabled ? "Enabled" : "Disabled"}</span>
          </h2>
          <p>{s.description}</p>
          <p className="hint"><strong>Limits:</strong> {s.caveat}</p>
        </section>
      ))}
      <h2 style={{ marginTop: "2rem" }}>How evidence strength is decided</h2>
      <ul>
        <li><strong>None:</strong> no source had a matching entry.</li>
        <li><strong>Low:</strong> a claim comes from one source, only from demo data, or sources disagree.</li>
        <li><strong>Moderate:</strong> at least one claim is stated by two independent, non-demo sources that agree, and nothing conflicts.</li>
      </ul>
      <p className="hint">This is a rule-based label, not a probability. It says nothing about how a particular person pronounces or spells their own name.</p>
    </>
  );
}
