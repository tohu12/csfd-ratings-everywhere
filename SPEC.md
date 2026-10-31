# ČSFD hodnocení všude (ČSFD Ratings Everywhere) – functional specification

The source of truth for behaviour. Reviewers check diffs against this file; change it in the same PR as any behaviour change.

## 1. Purpose

On any web page, find links to ČSFD film pages, written as plain text or as existing `<a>` elements. Make plain-text links clickable and show the film's ČSFD rating next to them.

On selected streaming (VOD) sites, which never link to ČSFD, show the rating of the film or series whose detail view is open, found by its title (§4b).

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

## 4. When ratings are fetched

- **Cache first:** a rating already in the cache is shown as soon as its badge becomes visible, without network (`peekRating`).
- **Automatically, capped:** in badge mode, when a badge becomes visible and its film is not cached, the rating is fetched without any user action, for the **first 10 distinct films per page**. Any number of links to the same film count as one film and cause one request. There is no setting for this.
- **On user action, beyond the cap** (and always in tooltip mode):
  - **Hover:** a trusted `mouseenter` on the link (or its badge) that rests for 150 ms. Leaving earlier cancels it.
  - **Keyboard:** a trusted `focus` within 1 s after a real key press. `element.focus()` from page scripts produces a trusted focus event without a key press, so it never counts.
  - Synthetic events from page scripts (`isTrusted === false`) never trigger anything.
- A film known on the page (`ok`/`none`) is never requested again on that page. Concurrent requests and cache lookups for one film are shared.
- An automatic load that ends in `error` (e.g. a full queue) leaves the badge idle so a hover can retry. `blocked` is shown.

## 4b. VOD detail views

- **Sites:** `netflix.com`, `disneyplus.com`, `hbomax.com`, `tv.apple.com` and their subdomains, HTTPS only. The curated list lives in `src/lib/vod/detect.ts`. A separate content script runs only there. Adding a site is an owner decision.
- **Detection:** a detail view is open when
  - the site's detail container is present (per-site hints: container, title, year, metadata row, series marker, anchor), or
  - generically: an `img[alt]` or `h1–h3` whose text equals the document title (brand, a leading "Watch"/"Sledujte" and bidi marks removed), plus a year or film/series signal.
  - Titles: the on-page title first (usually Czech), then the document title when it differs (HBO Max shows the English one).
  - Year and kind come **only from the metadata row** (the site's `meta` element, else the year element's parent; generically the page text without scripts/styles, capped at 10 000 characters). A synopsis or "more like this" list never decides them.
  - Year: the site's year element, else a year next to a duration or season count, or after "Rok:"/"Year:". A lone year (e.g. "2026 Oscar® Winner") is ignored.
  - Kind: the site's series marker, then the URL (`/show/`, `/series/` → series; `/movie/`, `/film/` → film), then the metadata row: a season count (`2 řady`, `4 části`, `minisérie`, `seasons` …; whole words only, so "sériích" does not count) → series, a duration → film, both or neither → unknown.
- **Badge:** one at a time. It goes after the site's anchor (the year or metadata row) or after the title element when that is visible. Otherwise it floats in the bottom-right corner. It first links to the ČSFD search; closing the detail view removes it. The page is re-checked at most every 300 ms after DOM changes, and after the user's first click or key press.
- **Requests:** a lookup (`findTitle`) is sent only when all hold:
  - the same title, year and kind were detected on **two checks in a row** (a detail view that renders in steps costs one lookup),
  - the year is known,
  - the user has interacted with the page (`navigator.userActivation.hasBeenActive`, which page scripts cannot fake and which resets on every page load); opening a detail view is that interaction on all supported sites,
  - fewer than **30** lookups were sent on this page load.
  - Browse rows, tiles and hover previews never trigger anything. Reopening a title reuses its answer; an `error` or `blocked` answer is not reused, so reopening retries.
  - Background: lookup cache → ČSFD search for the first title → the second title only if the first finds no match → the film page via `getRating` (cache first). An uncached title costs at most 3 requests.
- **Matching:**
  - exact title after normalisation (case, diacritics, punctuation, bidi marks), against the Czech or the original ČSFD name,
  - film: year ±1; series: ČSFD start year ≤ the VOD year (VOD sites show the latest season's year); a candidate without a year never fits,
  - kind must agree when both sides know it (ČSFD results without a type label are films; unknown labels leave the kind open),
  - several fits → the one with the exact year if unique,
  - anything else is `unsure`. Seasons and episodes in the results are ignored.
- **`unsure`** shows "ČSFD ?" linking to the ČSFD search for the first title. A possibly wrong percentage is never shown.
- `showRatings` off: the badge only links to the ČSFD search and nothing is fetched. `disabledHosts` applies as everywhere.

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
| unsure (VOD)     | `ČSFD ?`         | neutral                              | "Not sure which film this is. Search on ČSFD." |

- Texts are localised (cs, sk, en).

## 6. Fetching (background)

- Only the background context talks to the network.
- Messages:
  - `getRating` (cache, then network), sent automatically for the first 10 films per page or after a user action (§4),
  - `peekRating` (cache only),
  - `findTitle` (§4b): 1–2 well-formed titles of 1–200 characters, year 1800–2100 or null, kind `film`/`series` or null; answers `found` (id + rating), `unsure`, `blocked` or `error`,
  - `clearCache` (ratings and lookups).
  - Every message is validated, and the sender must be this extension.
- Requests go to `https://www.csfd.cz/film/<id>/prehled/` and, for §4b only, `https://www.csfd.cz/hledat/?q=<title>`, with default browser headers and the user's csfd.cz cookies, exactly like the user opening the link. Search requests share the backoff, rate limit and Anubis detection below.
- **Forbidden:** circumventing ČSFD's bot protection (Anubis): no proof-of-work solving, no header spoofing, no hidden tabs/iframes/offscreen documents, no prefetching beyond §4.
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
  - at most 2 000 entries; the oldest are evicted first,
  - title lookups (normalised titles, capped at 120 characters, + year + kind → id) separately: a found id for 30 days, `unsure` for 1 day, at most 500 entries.
- A storage failure never turns a fetched rating into an error.
- Parsing:
  1. JSON-LD: the item with `aggregateRating` (`ratingValue` scaled by `bestRating`, `ratingCount`, `name`), else an item whose `@type` is Movie/TVSeries/TVSeason/TVEpisode/CreativeWorkSeason (→ `none`). Other JSON-LD (WebSite, Organization…) is ignored.
  2. Fallback: `.film-rating-average` text + `<h1>` title.
  3. A page with neither → `error`.
  - The colour is derived from the percentage (§5a), not read from the page.
  - Search pages: each `<article>` with a `.film-title-name` link to `/film/<id>/` (the last id of nested URLs), the year and type from `.film-title-info` (no label or `TV film` → film; `seriál`/`TV seriál`/`TV pořad`/`minisérie` → series; `série`/`epizoda` → skipped; other labels → unknown); ids must be safe positive integers and the original name from `.search-name`.

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

## 7a. Onboarding

- On a fresh install (`runtime.onInstalled`, reason `install`), the extension opens its welcome page (`welcome.html`) once. Updates never open it.
- The page explains the linking, the "first 10 automatically, the rest on hover" rule, and the colour legend, and links to the settings. Texts are localised.

## 8. Permissions & privacy

- `storage`, `activeTab`; host permission `https://www.csfd.cz/*`; content script on `<all_urls>`, plus the VOD content script on the §4b sites (covered by `<all_urls>`, no extra permission).
- No analytics or remote code. Nothing leaves the browser except the requests to csfd.cz described in §4 and §6.
- Those requests reveal to ČSFD which films are linked on pages the user views and, on VOD sites, which titles' detail views the user opens. Firefox declares this as `data_collection_permissions.required: ["websiteContent"]`; Chrome's privacy form says the same.

## 9. Budgets

- Content script ≤ 8 kB gzip; VOD content script ≤ 6 kB gzip; background ≤ 10 kB gzip.
- A page without ČSFD links costs one native `querySelectorAll` on `href` plus one case-insensitive `textContent` test.
- Unit-test coverage: 100 % lines/branches/functions/statements of `src/`.
