# Privacy (prototype)

This document describes what the NameLens prototype does today. It is not a privacy policy for a production service and makes no claim of compliance with GDPR or any other law. Personal names are personal data in many contexts; a production service would need a lawful basis, a data-protection impact assessment, retention rules and more (see "Before production").

## What is sent to the NameLens server

- **Lookup:** the name typed into the web app, or the text selected and sent by the extension. Nothing else from the page: no URL, title, page content or browsing history.
- **Feedback (only if the user submits it):** the name shown, the useful / pronunciation-correct answers, the optional suggested pronunciation and correction text.

## What the server stores

| Data | Stored? |
|---|---|
| Looked-up names | **Not written to the database or to application logs.** The normalised name is held as a cache key in server memory for up to one hour (default) and is lost on restart. |
| Feedback | Yes, in the `feedback` table: normalised name, useful, pronunciation_correct, suggested_pronunciation, suggestion, creation time, and a SHA-256 hash of the delete token. |
| IP address, user agent, cookies, accounts | Not stored by the application. Hosting providers and proxies may keep their own logs; that is outside this code. |

The free-text fields are entered by users and could contain anything, including personal data. They are limited to 200 and 500 characters.

## Third-party providers

To answer a lookup the server sends individual name parts (at most three terms) to:

- **Wikidata** (`www.wikidata.org`) and **Wikipedia** (`en.wikipedia.org`), operated by the Wikimedia Foundation. They receive the server's IP address and a `NameLens/0.1` user agent, not the user's.

The curated demo source is local and sends nothing. If a result includes pronunciation audio, the browser loads it directly from Wikimedia Commons when the user plays it, which discloses the user's IP address to Wikimedia.

## Deletion

After submitting feedback the user receives a one-time token (kept in page memory only) and can delete that feedback immediately with "Delete my feedback". Once the page is closed the token is gone and the entry can only be removed by whoever administers the database. There is no retention limit or automatic deletion.

## Extension

- Runs only when the user picks the context-menu item or opens the popup; it reads only the current selection.
- Never reads password fields.
- Sends the selection to the API host it was built with (shown in the popup).
- Optional lookup history is **off by default**, stored in `chrome.storage.local` on the device, capped at 10 entries, never uploaded, and clearable from the popup.

## Development and demo assumptions

- Local SQLite or the bundled PostgreSQL with a development password.
- No consent banner, privacy notice acceptance, age gate or data-subject request process.

## Before production

A lawful basis and notice; retention and deletion policy; rate limiting and abuse handling; a documented data-processing arrangement for hosting; review of Wikimedia terms and attribution requirements; ethical review before collecting feedback for research; a decision on whether names should ever be logged.
