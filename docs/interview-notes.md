# Interview notes

Answers grounded in what the repository actually does. Adjust the wording to your own voice; do not claim more than is written here.

**Why did you build this?** To show I can build the kind of software the role describes (a web app and a browser plugin for name information) and to practise the research thinking around it: provenance, uncertainty, multilingual text. It is independent of MyNameIS and I say so in the README.

**What problem does it address?** Name information is scattered, incomplete and sometimes contradictory, and tools often present one confident answer. NameLens keeps every claim tied to its source and says when evidence is missing.

**Why a browser extension?** Names appear in context on web pages. Selecting one and asking about it is the shortest path, and the extension can be built with very few permissions: it only acts when the user clicks the menu item.

**How does the architecture work?** The extension popup and the React app call a FastAPI API. The API normalises the name, queries providers concurrently, groups and ranks evidence, assesses uncertainty and returns everything with provenance. Only feedback is stored (PostgreSQL, or SQLite for local use).

**How does retrieval work?** Lookup terms are built from the name and its parts; Wikidata, Wikipedia and a small curated source are queried in parallel; results are matched ignoring case and diacritics, de-duplicated by source, and ranked by a transparent source-type weight. Weights are my heuristic, not validated.

**How do you handle unreliable information?** Sources are typed and labelled; a curated demo source never counts as corroboration; disagreement is displayed; the confidence label is rule-based (none/low/moderate); a provider outage is shown rather than hidden; when nothing is found the UI says so.

**How do you handle ambiguous names?** One-part names, mixed scripts, CJK without spaces and three-plus part names are flagged, and the system never assumes which part is the given or family name. It shows notes rather than guessing.

**How did you handle privacy?** The extension reads only the selection, never password fields, and injects only on click. Analyses are not stored; feedback is, and can be deleted by the submitter. History is opt-in and local. Wikimedia receives name parts. I documented this in PRIVACY.md and did not claim GDPR compliance.

**How did you test it?** 80 backend tests (Unicode edge cases, providers with mocked HTTP, API validation, failure handling, feedback), 39 web tests including axe-core, 31 extension tests with a mocked Chrome API. Gaps: no live-provider tests, no real-browser extension test, no manual screen-reader testing.

**What was difficult?** Deciding what not to claim: uncertainty wording, not implying authority for a small curated source, not assuming name structure. Technically: keeping the extension's permissions minimal and testing it without a browser. A real bug found by tests: the extension's API helper dropped custom headers, which would have broken feedback deletion.

**What would you improve?** Verify against live providers and add recorded-response tests; add real-browser extension tests; user research with people whose names are often mishandled; a validated evaluation set for ranking and confidence; pronunciation recording with the name owner; rate limiting and a retention policy.

**What did you learn?** That provenance and honest "I don't know" states are design work, not decoration; that Unicode handling needs explicit decisions (ZWJ, NFC, bidi controls); and that privacy claims should be limited to what the code demonstrably does.

**How does this relate to the work you want to do?** It combines the pieces the role names, in miniature: browser plugin, web application, name and text processing, retrieval, user feedback and research documentation. It is evidence of engineering readiness, not of research results.
