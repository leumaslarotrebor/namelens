import { useId, useState } from "react";
import { ApiError, deleteFeedback, sendFeedback } from "../lib/api";
import type { FeedbackReceipt } from "../lib/types";

type YesNo = "yes" | "no" | "";
const toBool = (v: YesNo) => (v === "" ? null : v === "yes");

function YesNoGroup({ legend, name, value, onChange, yes = "Yes", no = "No" }:
  { legend: string; name: string; value: YesNo; onChange: (v: YesNo) => void; yes?: string; no?: string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="seg">
        <label><input type="radio" name={name} value="yes" checked={value === "yes"} onChange={() => onChange("yes")} /><span>{yes}</span></label>
        <label><input type="radio" name={name} value="no" checked={value === "no"} onChange={() => onChange("no")} /><span>{no}</span></label>
      </div>
    </fieldset>
  );
}

export function FeedbackForm({ name }: { name: string }) {
  const id = useId();
  const [useful, setUseful] = useState<YesNo>("");
  const [pron, setPron] = useState<YesNo>("");
  const [suggestedPron, setSuggestedPron] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(null);
  const [deleted, setDeleted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!useful && !pron && !suggestedPron.trim() && !suggestion.trim()) {
      return setError("Answer a question or write a correction before sending.");
    }
    setBusy(true); setError(null);
    try {
      setReceipt(await sendFeedback({
        name, useful: toBool(useful), pronunciation_correct: toBool(pron),
        suggested_pronunciation: suggestedPron.trim() || null, suggestion: suggestion.trim() || null,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send feedback. Try again.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!receipt) return;
    try { await deleteFeedback(receipt); setDeleted(true); setReceipt(null); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not delete feedback."); }
  }

  if (deleted) return <section className="block feedback"><h2>Feedback</h2><p role="status">Your feedback was deleted.</p></section>;
  if (receipt) {
    return (
      <section className="block feedback" aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`}>Feedback</h2>
        <div className="feedback-done">
          <p role="status" style={{ margin: 0 }}>Thanks. Your feedback was saved.</p>
          <button type="button" className="btn secondary" onClick={remove}>Delete my feedback</button>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="hint">You can delete it now. After you leave this page it can no longer be linked back to you.</p>
      </section>
    );
  }
  return (
    <section className="block feedback" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Feedback</h2>
      <form onSubmit={submit} noValidate>
        <YesNoGroup legend="Was this information useful?" name={`${id}-useful`} value={useful} onChange={setUseful} />
        <YesNoGroup legend="Was the pronunciation correct?" name={`${id}-pron`} value={pron} onChange={setPron} yes="Correct" no="Incorrect" />
        <div className="field">
          <label htmlFor={`${id}-sp`}>Suggested pronunciation (optional)</label>
          <input id={`${id}-sp`} type="text" maxLength={200} value={suggestedPron} onChange={(e) => setSuggestedPron(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-sc`}>Suggest a correction (optional)</label>
          <textarea id={`${id}-sc`} maxLength={500} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} aria-describedby={`${id}-p`} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
        <p id={`${id}-p`} className="hint">
          This sends your answers and the name shown above (“{name}”) to the NameLens server. No account or IP address is stored by the app; the hosting provider may keep ordinary server logs.
        </p>
      </form>
    </section>
  );
}
