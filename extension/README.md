# NameLens Chrome extension

Manifest V3, TypeScript, bundled with esbuild.

## Build and load

```bash
npm ci
API_BASE=http://localhost:8000 WEB_BASE=http://localhost:8000 npm run build   # → dist/
```

`chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`. To point at a deployed API, set `API_BASE` (and `WEB_BASE`) at build time; the API origin becomes the only host permission. `npm run zip` creates `namelens-extension.zip` from `dist/`.

## How it works

1. Select a name on any page and right-click → **Explore this name with NameLens**.
2. The service worker injects `content.js` into that tab and frame (via `activeTab`) and asks it for the selection. If the page cannot be scripted it uses the text Chrome supplies with the click.
3. The selection is cleaned locally (whitespace, control characters, Unicode NFC) and refused if empty or longer than 200 characters.
4. A small popup window opens, sends only that text to the API, and shows a compact result: name, notes, confidence, retrieved evidence with sources, feedback, and a link to the full web view.
5. You can also click the toolbar icon and type a name.

States handled: no selection, empty selection, over-long selection, loading, network failure or backend unavailable (with retry), server validation errors, no reliable information, provider failures, successful response.

## Permissions

| Permission | Why |
|---|---|
| `contextMenus` | The right-click item for selected text |
| `activeTab` | Temporary access to the tab you clicked in, only after you click |
| `scripting` | Injects the content script on that click |
| `storage` | Opt-in local history setting and history |
| host: API origin | The popup calls the NameLens API |

The content script does nothing until it receives a message, never reads password fields and never touches the network. See [../PRIVACY.md](../PRIVACY.md).

## Tests

`npm test` (31 tests): selection cleaning, menu registration, content-script injection and fallback, empty and long selections, page URL never forwarded, popup states (success, insufficient, ambiguity, network failure and retry, server errors), hostile-text rendering, opt-in history, feedback and deletion. Not covered: a real Chrome instance driving the built extension.
