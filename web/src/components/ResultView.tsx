import type { AnalyzeResponse, Claim, ClaimValue } from "../lib/types";
import { isCommonsAudio, safeHref, STRENGTH_LABEL, TYPE_LABEL } from "../lib/util";
import { FeedbackForm } from "./FeedbackForm";
import { Process } from "./Process";

function SourceLink({ title, url }: { title: string; url: string }) {
  const href = safeHref(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{title}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{title}</span>;
}

function ValueRow({ claim, v }: { claim: Claim; v: ClaimValue }) {
  const isAudio = claim.claim_type === "audio";
  return (
    <div className="value">
      {isAudio && isCommonsAudio(v.value)
        // eslint-disable-next-line jsx-a11y/media-has-caption -- short spoken name clip; no speech to caption beyond the name shown
        ? <audio controls preload="none" src={v.value} aria-label="Pronunciation audio from Wikimedia Commons" />
        : <span className={`v ${claim.claim_type === "pronunciation" ? "ipa" : ""}`} dir={claim.claim_type === "pronunciation" ? "ltr" : "auto"}>{v.value}</span>}
      {v.qualifier && <span className="q">({v.qualifier})</span>}
      <span className="n">{v.independent_sources} independent {v.independent_sources === 1 ? "source" : "sources"}</span>
      <details className="ev">
        <summary>Show evidence ({v.evidence.length})</summary>
        <ul>
          {v.evidence.map((e, i) => (
            <li key={i}>
              <SourceLink title={e.source.title} url={e.source.url} />{" "}
              <span className={`type-tag ${e.source.type}`}>{TYPE_LABEL[e.source.type] ?? e.source.type}</span>
              <blockquote>{e.excerpt}</blockquote>
              <span className="hint">Retrieved {new Date(e.retrieved_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function ResultView({ result }: { result: AnalyzeResponse }) {
  const scripts = Object.keys(result.scripts).map((s) => s.charAt(0) + s.slice(1).toLowerCase());
  return (
    <article aria-labelledby="result-name">
      <header className="result-head">
        <p className="selected-label">Selected name</p>
        <h2 id="result-name" className="name-display" dir="auto">{result.name}</h2>
        <ul className="parts" aria-label="Name parts">
          {result.parts.map((p, i) => (
            <li key={i} dir="auto">{p.text}{p.is_particle && <small>particle</small>}</li>
          ))}
        </ul>
        <p className="meta">
          {scripts.length ? `Writing system: ${scripts.join(", ")}. ` : ""}
          {result.parts.length} {result.parts.length === 1 ? "part" : "parts"}.
        </p>
      </header>

      {result.notes.length > 0 && (
        <aside className="notice info" aria-label="Notes about this name">
          <strong>{result.ambiguous ? "This name is ambiguous." : "Notes"}</strong>
          <ul>{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </aside>
      )}

      {result.provider_errors.length > 0 && (
        <div className="notice warn" role="status">
          <strong>Some sources could not be reached.</strong> Results may be incomplete.
          <ul>{result.provider_errors.map((e) => <li key={e.provider}>{e.message}</li>)}</ul>
        </div>
      )}

      <p className="strength">
        <span>Confidence and uncertainty:</span>
        <span className={`badge ${result.strength}`}>{STRENGTH_LABEL[result.strength]}</span>
        <span className="hint" style={{ margin: 0 }}>{result.strength_explanation}</span>
      </p>

      {result.sources.some((s) => s.type === "demo_fixture") && (
        <p className="notice warn" role="note">Some information comes from a small hand-curated demo source. It is not an authoritative linguistic database.</p>
      )}

      {result.status === "insufficient" ? (
        <section className="empty" aria-labelledby="empty-h">
          <h2 id="empty-h">Insufficient reliable information found.</h2>
          <p>None of the configured sources had a matching entry. NameLens does not guess. You could try a different spelling or script, look up one part of the name at a time, or ask the person how their name is pronounced. Pronunciation: not available.</p>
        </section>
      ) : (
        <section className="block" aria-labelledby="claims-h">
          <h2 id="claims-h">Retrieved evidence</h2>
          <p className="hint">Source-reported information, not verified facts. Open “Show evidence” to see what each source said.</p>
          {result.terms.map((t) => (
            <div key={t.term}>
              <h3 className="term-title" dir="auto">{t.term}</h3>
              {t.claims.some((c) => c.disagreement) && (
                <p className="notice warn" role="note">Sources disagree about at least one claim below, or the name has more than one use. Both are shown.</p>
              )}
              <dl className="claims">
                {!t.claims.some((c) => c.claim_type === "pronunciation" || c.claim_type === "audio") && (
                  <>
                    <dt>Possible pronunciation</dt>
                    <dd className="unavailable">Not available. No pronunciation information was found for this name in the configured sources.</dd>
                  </>
                )}
                {t.claims.map((c) => (
                  <div key={c.claim_type} style={{ display: "contents" }}>
                    <dt>{c.label}{c.disagreement && " (sources differ)"}</dt>
                    <dd>{c.values.map((v) => <ValueRow key={v.value + v.qualifier} claim={c} v={v} />)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}

      <Process result={result} />

      {result.sources.length > 0 && (
        <section className="block" aria-labelledby="src-h">
          <h2 id="src-h">Sources</h2>
          <ol className="sources-list">
            {result.sources.map((s) => (
              <li key={s.url}><SourceLink title={s.title} url={s.url} />{" "}
                <span className={`type-tag ${s.type}`}>{TYPE_LABEL[s.type] ?? s.type}</span></li>
            ))}
          </ol>
        </section>
      )}

      <FeedbackForm key={result.name} name={result.name} />
    </article>
  );
}
