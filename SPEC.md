# ČSFD hodnocení všude (ČSFD Ratings Everywhere) – functional specification

The source of truth for behaviour. Reviewers check diffs against this file; change it in the same PR as any behaviour change.

## 1. Purpose

On any web page, find links to ČSFD film pages, written as plain text or as existing `<a>` elements. Make plain-text links clickable and show the film's ČSFD rating next to them.

Unofficial project, not affiliated with ČSFD.

## 2. Recognised URLs

- Hosts: `csfd.cz`, `www.csfd.cz`, `m.csfd.cz`, `csfd.sk`, `www.csfd.sk`. The scheme (`http`/`https`) is optional.
- Optional language prefix: `/sk`, `/en`.
- Path `/film/<id>[-slug][/<childId>[-slug]][/<anything>]`:
  - `<id>` is digits; the slug is any run of non-space, non-slash characters.
  - Series → season → episode URLs nest ids; the **last** id identifies the item.
- Trailing punctuation `. , ; : ! ? ) ] } > " '` is not part of the URL. It is trimmed in linear time.
- Only `/film/` URLs (no `/tvurce/`, `/uzivatel/`, search pages).
- A ČSFD URL glued to the end of a longer word (e.g. `xcsfd.cz`) is not matched.

## 3. Linkify

- Runs on all pages except ČSFD itself (`*.csfd.cz`, `*.csfd.sk`), which already shows ratings.
- Plain-text matches become `<a href="https://<url without scheme>" target="_blank" rel="noopener noreferrer">`. The link text stays exactly the original text.
- Never touched: anything inside `a, script, style, noscript, textarea, input, select, option, code, pre, svg, [contenteditable]` (except `contenteditable="false"`), plus the extension's own nodes. This applies to text **and** to existing anchors: no badge is inserted into editors such as e-mail compose windows.
- Existing `<a>` elements pointing to a ČSFD film are never modified; they only get a badge or hover card.
- Content added later (SPA, infinite scroll, chat) is processed too:
  - only the added nodes, debounced by 300 ms,
  - a node whose ancestor was added in the same batch is not scanned twice.
- Large pages are processed in idle-time chunks so the main thread is never blocked for long.

## 4. When ratings are fetched (user action only)

ČSFD is only contacted after a **real user action** on a specific link. Like opening the link, it is the user's own request.

- **Hover:** a trusted `mouseenter` on the link (or its badge) that rests for 150 ms. Leaving earlier cancels it.
- **Keyboard:** a trusted `focus` within 1 s after a real key press. `element.focus()` from page scripts produces a trusted focus event without a key press, so it never counts.
- Synthetic events from page scripts (`isTrusted === false`) never trigger anything.
- Ratings already in the cache are shown without any action and without network (`peekRating`), as soon as the badge becomes visible.
- A film known on the page (`ok`/`none`) is never requested again on that page. `blocked`/`error` may be retried by the next action.

## 5. Display modes (`display` setting)

- `badge` (default): an inline pill right after every link (§5a).
- `tooltip`: nothing is inserted next to links; plain-text URLs still become links.
  - One shared, fixed-position card (shadow DOM, `pointer-events: none`) appears on hover intent or keyboard focus and hides on leave/blur.
  - Late answers for a link that is no longer shown are dropped.

### 5a. Badge

- `<span data-csfd-linker="badge">` with an open shadow root: page CSS cannot change it, and its CSS never leaks out.
- The badge links to `https://www.csfd.cz/film/<id>/prehled/` (new tab).
- States:

| state            | text             | colour                               | tooltip                            |
| ---------------- | ---------------- | ------------------------------------ | ---------------------------------- |
| idle             | `ČSFD`           | neutral                              | "Hover to load the ČSFD rating"    |
| loading          | `ČSFD` (pulsing) | neutral                              | "Loading ČSFD rating…"             |
| ok               | `78 %`           | red ≥ 70, blue 30–69, dark grey < 30 | "<title> – 78 % (12 345 ratings)"  |
| none             | `– %`            | light grey                           | "No rating yet"                    |
| blocked          | `ČSFD !`         | neutral                              | "ČSFD did not return the rating right now. Try again later." |
| error            | `ČSFD`           | neutral                              | "Rating unavailable"               |
| ratings disabled | `ČSFD`           | neutral                              | "Open on ČSFD"                     |

- Texts are localised (cs, sk, en).

## 6. Fetching (background)

- Only the background context talks to the network.
- Messages:
  - `getRating` (cache, then network) is sent only after a user action (§4),
  - `peekRating` (cache only),
  - `clearCache`.
  - Every message is validated, and the sender must be this extension.
- Requests go to `https://www.csfd.cz/film/<id>/prehled/` with default browser headers and the user's csfd.cz cookies, exactly like the user opening the link.
- **Forbidden:** circumventing ČSFD's bot protection (Anubis): no proof-of-work solving, no header spoofing, no hidden tabs/iframes/offscreen documents, no automatic background traffic.
- Slow-down handling:
  - an Anubis page → `blocked`, and all fetching pauses with exponential backoff (10 min, ×2, max 6 h),
  - HTTP 429/503 → `blocked`, with the same backoff, at least as long as `Retry-After`,
  - concurrent "slow down" answers count as one backoff step,
  - while paused, requests resolve `blocked` without network.
- Rate limit:
  - at most 2 concurrent requests, ≥ 400 ms between request starts,
  - at most 20 waiting requests (more resolve `error`, uncached),
  - concurrent requests for one id share one fetch.
- Cache (`storage.local`):
  - `ok` for 7 days, `none` for 1 day, HTTP 404/410 as `error` for 1 day,
  - `blocked` and other errors are not cached,
  - at most 2 000 entries; the oldest are evicted first.
- A storage failure never turns a fetched rating into an error.
- Parsing:
  1. JSON-LD: the item with `aggregateRating` (`ratingValue` scaled by `bestRating`, `ratingCount`, `name`), else an item whose `@type` is Movie/TVSeries/TVSeason/TVEpisode/CreativeWorkSeason (→ `none`). Other JSON-LD (WebSite, Organization…) is ignored.
  2. Fallback: `.film-rating-average` text + `<h1>` title.
  3. A page with neither → `error`.
  - The colour is derived from the percentage (§5a), not read from the page.

## 7. Settings (`storage.sync`)

- `enabled` (default true): global switch.
- `showRatings` (default true): when false, links show "ČSFD" only and nothing is fetched.
- `display` (default `badge`): `badge` | `tooltip` (§5).
- `disabledHosts` (default []): hostnames, normalised (lower case, no `www.`), where the content script does nothing.
- Popup:
  - toggle for the current site (disabled on browser pages, and on ČSFD itself with the note "not needed on ČSFD"),
  - global toggle,
  - number of ČSFD links on the current page,
  - link to options.
- Options page: all settings + "Clear cache".
- Every change is a read-modify-write of the latest stored value, so the popup and options page never overwrite each other.
- Changes apply on the next page load.

## 8. Permissions & privacy

- `storage`, `activeTab`; host permission `https://www.csfd.cz/*`; content script on `<all_urls>`.
- No analytics or remote code. Nothing leaves the browser except the user-triggered requests to csfd.cz described in §4 and §6.

## 9. Budgets

- Content script ≤ 8 kB gzip; background ≤ 10 kB gzip.
- A page without ČSFD links costs one native `querySelectorAll` on `href` plus one case-insensitive `textContent` test.
- Unit-test coverage: 100 % lines/branches/functions/statements of `src/`.
