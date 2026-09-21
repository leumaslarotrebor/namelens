# Security review (prototype)

Scope: the code in this repository as it stands. This is a practical self-review, not an audit or penetration test.

## Measures in place

| Area | What the code does |
|---|---|
| Input validation | Pydantic limits (500 raw characters); server-side normalisation rejects empty input, URLs, email addresses, markup characters, more than two digits and more than 10 parts; control and bidi-override characters stripped |
| Output handling | React escapes all text; the extension builds DOM with `textContent` only; tests render hostile names and excerpts and assert nothing executes |
| Links | Only `http(s)` URLs from API data are rendered as links; audio is only played from `commons.wikimedia.org` FilePath URLs |
| SQL | SQLAlchemy ORM with bound parameters; no string-built SQL |
| CORS | Explicit origin list (`CORS_ORIGINS`), methods and headers restricted |
| Headers | `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on every response |
| Feedback deletion | Random 192-bit token, only its SHA-256 hash stored, constant-time comparison; wrong token and missing entry are indistinguishable |
| Errors | Uniform error envelope; unexpected errors return a generic message and are logged server-side without request bodies |
| Secrets | None required; `.env` is git-ignored; `.env.example` contains no secrets |
| Containers | Application runs as a non-root user |
| Extension | Manifest V3, minimal permissions, no remote code, strict extension-page CSP, host permission for a single API origin |
| Provider calls | Timeouts, failures isolated per provider, failed lookups never cached |

## Extension permissions

| Permission | Why |
|---|---|
| `contextMenus` | Adds "Explore this name with NameLens" for selected text |
| `activeTab` | Temporary access to the tab where the user clicked the menu item |
| `scripting` | Injects the small content script into that tab and frame on click |
| `storage` | Remembers the opt-in history setting and history |
| host permission (API origin only) | Lets the popup call the NameLens API |

No `tabs`, `history`, `cookies`, `webRequest`, `<all_urls>` or broad host permissions are requested.

## Known gaps

- No authentication and no rate limiting: anyone who can reach the API can call it and can also submit feedback, and the API can be used to generate load against Wikidata and Wikipedia.
- The CSP allows inline style attributes (`style-src 'unsafe-inline'`) because the UI uses a few.
- No HTTPS termination in the application; a reverse proxy is required.
- Tables are created at start-up with `create_all`; there are no migrations.
- Feedback has no size or count limits per client and no moderation.
- Backend dependencies are pinned; JavaScript dependencies use lockfiles but no automated vulnerability scanning is configured.
- The extension is unsigned and not published; the API base URL is fixed at build time.
- Live provider responses are trusted after shape checks; a compromised upstream could still supply misleading text (rendered as text, never HTML).

## Before production

Authentication or abuse controls, rate limiting, HTTPS and HSTS, migrations, dependency scanning in CI, logging and monitoring policy, backup and deletion procedures, a third-party review.

## Reporting

This is a personal portfolio project. Report issues through the GitHub repository's issue tracker.
