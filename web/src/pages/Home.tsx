import { useNavigate } from "react-router-dom";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { useTitle } from "../lib/useTitle";
import { EXAMPLES } from "../lib/util";

export function Home() {
  const navigate = useNavigate();
  useTitle("");
  return (
    <>
      <h1>Look up a name and see where every claim comes from.</h1>
      <p>NameLens finds public information about a name and shows the source and the evidence behind each claim. When it cannot find reliable information, it says so instead of guessing.</p>
      <AnalyzeForm onSubmit={(n) => navigate(`/analyze?name=${encodeURIComponent(n)}`)} />
      <h2>Why Unicode-aware processing matters</h2>
      <p>Names are written in many scripts, and the same visible text can be encoded in more than one way. NameLens normalises the text, reports the writing system it finds, and does not assume a given-name and family-name order. Try one of these:</p>
      <table className="script-table">
        <caption>Example names by writing system</caption>
        <thead className="sr-only"><tr><th scope="col">Writing system</th><th scope="col">Example name</th></tr></thead>
        <tbody>
          {EXAMPLES.map((ex) => (
            <tr key={ex.name}>
              <th scope="row">{ex.script}</th>
              <td><button type="button" dir="auto" onClick={() => navigate(`/analyze?name=${encodeURIComponent(ex.name)}`)}>{ex.name}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>How it works</h2>
      <ol className="hero-steps">
        <li><h3>Select a name</h3><p>On any web page, select a name and choose “Explore this name with NameLens”, or type it here.</p></li>
        <li><h3>Check the evidence</h3><p>Each claim lists its sources, the supporting text and how strong the evidence is. Disagreements are shown, not hidden.</p></li>
        <li><h3>Correct it</h3><p>Tell NameLens if the information was useful or the pronunciation was wrong, and suggest a correction.</p></li>
      </ol>
    </>
  );
}
