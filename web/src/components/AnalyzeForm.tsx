import { useEffect, useId, useState } from "react";
import { QUICK_EXAMPLES } from "../lib/util";

interface Props {
  initial?: string;
  busy?: boolean;
  onSubmit: (name: string) => void;
  showExamples?: boolean;
}

export function AnalyzeForm({ initial = "", busy = false, onSubmit, showExamples = true }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => setValue(initial), [initial]);

  function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a name to look up.");
    if (trimmed.length > 100) return setError("Names longer than 100 characters are not supported.");
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form className="lookup" noValidate onSubmit={(e) => { e.preventDefault(); submit(value); }}>
      <label htmlFor={`${id}-name`}>Name to look up</label>
      <div className="row">
        <input
          id={`${id}-name`} type="text" value={value} dir="auto" autoComplete="off" spellCheck={false}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : `${id}-hint`}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Looking up…" : "Look up name"}</button>
      </div>
      {error ? <p id={`${id}-err`} className="field-error" role="alert">{error}</p>
             : <p id={`${id}-hint`} className="hint">Any script works. Only this text is sent to the server.</p>}
      {showExamples && (
        <div className="examples">
          <span className="hint" style={{ margin: 0 }}>Try:</span>
          {QUICK_EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip"
              onClick={() => { setValue(ex); submit(ex); }}>{ex}</button>
          ))}
        </div>
      )}
    </form>
  );
}
