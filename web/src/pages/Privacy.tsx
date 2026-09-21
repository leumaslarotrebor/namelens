import { useTitle } from "../lib/useTitle";

export function Privacy() {
  useTitle("Privacy");
  return (
    <div className="prose">
      <h1>Privacy</h1>
      <p>NameLens is a portfolio project built to show privacy-aware design. This page describes what the software does. It is not a legal statement and does not claim compliance with any regulation.</p>
      <h2>What is sent</h2>
      <ul>
        <li>The name you type, or the text you select and choose to look up. Nothing else from the page.</li>
        <li>If you send feedback: your answers, your written correction and the name shown on screen.</li>
      </ul>
      <h2>What is not collected</h2>
      <ul>
        <li>No page content, page URL or browsing history. The extension never reads a page until you choose the menu item, and then reads only your selection.</li>
        <li>No accounts, cookies for tracking, analytics or advertising identifiers.</li>
        <li>The app does not store your IP address. The hosting provider may keep ordinary server logs.</li>
      </ul>
      <h2>Where it goes</h2>
      <p>Names are sent to the NameLens server, which forwards individual name parts to public services (Wikidata and Wikipedia) to look them up. Those services receive the name parts and the server’s address, not yours. Lookups are not stored; results are cached in server memory for up to an hour and are not linked to you.</p>
      <p>Feedback is stored in a PostgreSQL database. After you send feedback you get a one-time delete token that lets you remove that feedback from this page.</p>
      <h2>Extension</h2>
      <p>The extension keeps a short lookup history on your device only, in browser storage. You can clear it from the extension popup at any time. It is never uploaded.</p>
    </div>
  );
}
