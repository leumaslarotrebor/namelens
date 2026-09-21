# Accessibility

Target: WCAG 2.2 AA behaviours where practical. This is an engineering self-assessment; no audit by an accessibility specialist and no testing with assistive-technology users has been carried out.

## Implemented

- **Structure:** skip link, `header`/`nav`/`main`/`footer` landmarks, one `h1` per page, ordered headings, `aria-current="page"` on the active link.
- **Focus:** the main region receives focus on navigation; all controls have a visible 3px focus ring; native controls throughout (no clickable divs).
- **Forms:** every input has a visible label; validation errors are announced with `role="alert"` and linked with `aria-describedby`; invalid inputs set `aria-invalid`.
- **Feedback controls:** yes/no questions are radio groups inside `fieldset`/`legend`, so arrow-key navigation and group names work natively.
- **Status:** loading uses `role="status"` in an `aria-live` region; provider failures use `role="status"`; errors use `role="alert"`.
- **Meaning without colour:** confidence is shown as text ("Low", "Moderate"), disagreement is stated in words, demo data is labelled in words.
- **Multilingual text:** names use `dir="auto"` so right-to-left names render correctly; IPA is forced `dir="ltr"`; font stacks include CJK fallbacks.
- **Motion and colour:** `prefers-reduced-motion` disables the loading pulse; light and dark themes via `prefers-color-scheme`.
- **Responsive:** single-column layout below 34rem; wide content wraps (`overflow-wrap`) instead of scrolling.
- **Links:** external links in result views state that they open in a new tab.
- **Extension popup:** same label, alert and status patterns, keyboard-operable, respects colour scheme.

## Automated checks

- ESLint with `jsx-a11y` on the web app (errors fixed, not disabled; one documented exception for a short pronunciation clip without captions).
- axe-core runs in the web test suite on the home, analyze, sources, privacy and about pages and on result views. Colour-contrast rules are disabled in jsdom because it does not compute layout or colours.

## Not done

- No manual screen-reader pass (NVDA, VoiceOver, TalkBack), no zoom/reflow audit at 400%, no measured contrast audit, no voice-control testing.
- The extension popup has not been checked in a real browser with assistive technology.
- Pronunciation audio has no transcript beyond the name shown on the page.
