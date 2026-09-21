# Research notes

These notes explain the thinking behind NameLens. They are not a paper and report no findings. No participants, interviews, surveys, accuracy figures or statistics exist for this project. Each section separates what is **implemented**, the **rationale**, and what is only **planned**.

## 1. Problem framing

Software that handles personal names often assumes one script, one word order and one pronunciation, and presents whatever it finds as fact. Information about a name (how it is written, which language it belongs to, how it is pronounced) is spread across sources of very different quality, is often missing, and is sometimes contradictory. The person a name belongs to is the best authority on it, and no public source replaces them.

## 2. Design questions

1. How can retrieved name information be shown so that its origin is always visible?
2. How can a system say "not enough evidence" clearly instead of guessing?
3. What must a Unicode-aware pipeline do so that names in different scripts are handled without assuming a Western given/family structure?
4. How can users correct or challenge what the system shows, with minimal data collected?

These are design questions the prototype makes concrete. The prototype does not answer them empirically.

## 3. System assumptions

- The user supplies or selects a name string; the system does not know who the person is.
- Public structured sources (Wikidata) and encyclopedic text (Wikipedia) describe how a name is used in general, not how an individual says or spells theirs.
- A small curated source is useful for offline demonstration only and is labelled as such.
- Only the name text is needed to answer a query; page context is unnecessary and is not collected.

## 4. Retrieval approach (implemented)

1. Validate and normalise the input (see §7).
2. Build lookup terms: the whole string if it has several parts, plus each non-particle token, with hyphenated tokens split. At most four terms; providers use the first three.
3. Query all enabled providers concurrently. Each provider returns `Evidence` objects or an error string; one provider failing never fails the request.
4. Match source entries to terms case- and diacritic-insensitively.
5. Group evidence per name part and claim type; de-duplicate repeated records from the same source URL; rank values by source-type weight (structured database 0.8, encyclopedia 0.7, curated demo 0.4), with a small bonus for agreement between independent sources.
6. Assess uncertainty (§6). Failed lookups are never cached.

Rationale: source weights are a transparent heuristic chosen by the author, not a tuned or validated ranking. Planned: evaluate ranking against human relevance judgements.

## 5. Evidence model (implemented)

Claim → supporting source → excerpt:

- **Claim types:** kind of name (given/family), language of origin, IPA pronunciation, pronunciation audio.
- **Source reference:** provider id, title, URL, type (`structured_database`, `encyclopedia`, `demo_fixture`).
- **Evidence:** the excerpt the claim was taken from, a score and a retrieval timestamp.
- **Qualifier:** e.g. a region. Pronunciations that differ by region are shown side by side and are not treated as a conflict.

Wikidata items are only used if their instance-of statements identify them as a name class; Wikipedia articles only if the title matches the term (or is a "(surname)"/"(given name)" article) and the introduction says so.

## 6. Uncertainty model (implemented)

A three-level, rule-based label: **none** (no evidence), **low** (single source, demo-only, or conflict), **moderate** (two independent non-demo sources agree and nothing conflicts). Disagreement is shown, not resolved. Names with one part, mixed scripts, three or more parts, or unknown boundaries are flagged as ambiguous. Provider outages are reported alongside results.

This is not a calibrated probability. There is no evidence yet that "moderate" corresponds to correctness. Planned: measure agreement between the label and human judgements.

## 7. Multilingual and Unicode considerations (implemented)

NFC normalisation; removal of control and bidi-override characters while keeping ZWJ/ZWNJ; whitespace collapse; script detection from Unicode character names; particle recognition (Latin and Arabic examples); flags for CJK strings without spaces; no assumed name order (the interface says so for scripts often written family-name-first). RTL names render with `dir="auto"`; IPA is forced left-to-right.

Known weaknesses: script detection is not language identification; particle lists are short and Eurocentric; transliteration between scripts is not attempted, so a name written in Latin and in its native script are different queries; Wikipedia lookups are English only.

## 8. User feedback considerations (implemented)

Users can mark information useful or not, mark pronunciation correct or incorrect, and suggest a pronunciation or correction. The store keeps only what was submitted (no IP, agent or account), and the submitter can delete their entry immediately. Planned: how feedback is triaged, whether suggestions should be shown to others, and how to protect people from harmful or private free text.

## 9. Evaluation plan (planned, not done)

- **Retrieval:** build a small, documented set of names across scripts with agreed relevance judgements; report coverage (how often any evidence is returned) and precision of returned claims; compare providers.
- **Uncertainty:** check whether confidence labels track correctness against the judgements.
- **Robustness:** Unicode edge-case corpus beyond the current unit tests; provider failure injection (partly done with mocks).
- **User research:** qualitative interviews with people whose names are often mis-rendered; task-based usability sessions with the extension and web app, including assistive-technology users; ethical review before any data collection.

## 10. Limitations

Curated data is tiny; Wikidata name coverage is incomplete and rarely includes pronunciation; sources are not authoritative; live provider behaviour was not verified in the development environment (tests use mocked HTTP); no user study or retrieval evaluation exists; weights and thresholds are unvalidated; no mobile application; no authentication or retention policy.

## 11. Future research (not implemented)

Recording and validating pronunciations with the name owner; phonetic representations beyond IPA strings; additional sources with clear licences; transliteration-aware matching; multilingual evaluation sets; longitudinal feedback analysis; studies of how uncertainty wording affects user trust and behaviour.
