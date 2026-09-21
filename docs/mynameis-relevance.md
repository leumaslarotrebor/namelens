# Relevance to MyNameIS: requirement mapping

I understand the MyNameIS role, from the role description I was given, as research and development of a web/mobile application and browser plugins that support people in capturing authentic information about their proper name. I have no inside knowledge of the project's design or requirements. This table maps the areas I understand the role to cover onto what NameLens actually implements, and says where it falls short. NameLens is an independent prototype, not an equivalent of MyNameIS.

| Area | NameLens evidence | Limitation / future work |
|---|---|---|
| Names | Name parsing, particles, ambiguity flags; no assumed given/family order | Heuristic; short particle lists; no cultural validation |
| Multilingual representation | NFC, script detection across Latin, Tamil, Devanagari, Arabic, Cyrillic, Greek, Han, kana, Hangul, Hebrew; RTL rendering; tests per script | Script ≠ language; no transliteration; English-language sources |
| Pronunciation | IPA and Commons audio shown only when a source provides them; regional variants kept separate; explicit unavailable state | Coverage very low; nothing is recorded from the name owner |
| Information retrieval | Provider abstraction, concurrent fan-out, matching, dedupe, ranking, cache | Ranking weights unvalidated; no evaluation set |
| User needs | Feedback capture, plain-language wording, carefully hedged claims | No user research has been done; needs are assumed, not elicited |
| Requirements | Requirements were derived by me from the role description and are recorded in these notes | Not validated with stakeholders |
| Web application | React/TypeScript app with analyze, sources, privacy, about | Not deployed; no accounts or saved name profile |
| Browser plugin | Chrome MV3 extension: context menu, content script, service worker, popup, minimal permissions | Chrome only; not published; not tested in a live browser session |
| Mobile | Responsive web layout only | No mobile app |
| Evidence and provenance | Each claim linked to source, type, excerpt, timestamp | Only three sources; no source licence tracking beyond notes |
| Uncertainty | Three-level rule-based label with reasons; conflicts and outages shown | Not calibrated against correctness |
| Research documentation | `research-notes.md` separating implemented, rationale and planned | No findings exist |
| Testing | pytest, Vitest, axe-core; edge cases for Unicode, failures, hostile text | No end-to-end browser tests; providers mocked |
| Accessibility | Landmarks, labels, alerts, RTL, reduced motion, axe checks | No manual assistive-technology testing |
| Privacy | Selected-text-only extension, no stored analyses, opt-in local history, deletable feedback; documented in `PRIVACY.md` | Not a compliance claim; no retention policy or consent flow |
