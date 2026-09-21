import { useTitle } from "../lib/useTitle";

export function About() {
  useTitle("About");
  return (
    <div className="prose">
      <h1>About NameLens</h1>
      <p>NameLens is an independent portfolio project by Samuel Oral Robert V. It explores how software can help people look up information about a name while staying honest about sources and uncertainty. It is not affiliated with Dublin City University or the MyNameIS project and is not an implementation of MyNameIS.</p>
      <h2>Pipeline</h2>
      <pre className="flow">{`input
  → validation (length, URLs/markup, digits)
  → Unicode NFC + whitespace normalisation
  → tokenising, particle and script detection
  → retrieval (Wikidata, Wikipedia, demo fixture)
  → ranking and grouping by claim
  → evidence strength + disagreement check
  → result with sources`}</pre>
      <h2>Technology</h2>
      <ul>
        <li>Chrome extension: Manifest V3, TypeScript, context menu, content script, service worker.</li>
        <li>Web app: React, TypeScript, Vite.</li>
        <li>API: FastAPI, Pydantic, SQLAlchemy, PostgreSQL.</li>
        <li>Tests: pytest, Vitest and Testing Library. CI: GitHub Actions. Docker for local and hosted runs.</li>
      </ul>
      <h2>Limits</h2>
      <ul>
        <li>Public sources describe how names are used in general. They cannot tell you how one person pronounces or spells their own name. Ask them.</li>
        <li>Most names have no pronunciation data in the configured sources.</li>
        <li>The given/family split is never assumed. Naming conventions differ across cultures.</li>
      </ul>
    </div>
  );
}
