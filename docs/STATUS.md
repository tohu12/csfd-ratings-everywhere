# Project status

Handover note for agents and humans. **Keep it current.** Update it in the same change whenever status, a decision or an open item changes. Last updated: 2026-11-01 (v1.2.0 tagged: VOD on 15 services, red UI; store images regenerated; draft GitHub Release, not in stores yet).

## In one paragraph
"ČSFD hodnocení všude / ČSFD Ratings Everywhere" is a WXT MV3 browser extension (Chrome, Edge, Firefox).
- On any site except ČSFD itself, it finds ČSFD film URLs (plain text or `<a>`) and linkifies the plain-text ones.
- It shows the film's rating as a badge (default) or as a hover card.
- Behaviour is specified in [SPEC.md](../SPEC.md); architecture and rules are in [AGENTS.md](../AGENTS.md).
- Owner: Tomáš Hulek (GitHub `tohu12`), who communicates in Czech.

## State
| Area | State |
|---|---|
| Code | **v1.2.0** (2026-11-01) adds VOD ratings (SPEC §4b) and the red icon/UI; v1.1.0 had the welcome page and the blue UI. VOD: detail views on Netflix, Disney+, HBO Max, JustWatch (per-site hints) and Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, Voyo SK, Canal+, Rakuten TV, MUBI, KVIFF.TV (generic detector) → ČSFD search → rating. Icon and UI accent are ČSFD red since 2026-11-01. Reviewed by code-, perf- and security-reviewer; confirmed findings fixed. Test counts and bundle sizes: run `pnpm check` and `pnpm size`. |
| VOD real-world check | **Not done yet.** Detection verified on DOM captured 2026-10-31 from the owner's logged-in sessions (Netflix, Disney+, HBO Max) and on public logged-out pages for the rest (2026-10-31 and 2026-11-01, `tests/fixtures/pages/vod/`). The search parser is tested on **real** ČSFD search pages (`search-silo.html`, `search-duna.html`, saved by the owner 2026-11-01); the real result links end in `/prehled/`, which the synthetic page lacked. Unknown: whether `/hledat/` requests pass Anubis like `/film/` ones. |
| Real-world check | 2026-10-31, headed Chrome with the owner on 8 warcenter.cz topics: **8/8 correct**, incl. series-episode URLs and unrated films. Extension requests to csfd.cz **pass Anubis**. |
| Stores | **Not submitted yet.** Texts in [store-listing.md](store-listing.md), graphics in `docs/store/`, plan in [launch-plan.md](launch-plan.md). |
| Website | GitHub Pages from `/docs`: https://tohu12.github.io/csfd-ratings-everywhere/ (landing page + `PRIVACY.html`). |
| Release pipeline | Tag `v*` → `release.yml` builds Chrome/Edge/Firefox zips (+ Firefox sources zip) into a **draft** GitHub Release. Store upload is manual for now. |
| Store packages | Use the **v1.2.0** release zips once released (red icon, VOD). v1.1.0 and older have the blue icon. The images in `docs/store/` were regenerated 2026-11-01 with the red UI. |

## Decisions (and why). Don't revert without asking the owner
- **Fetching** (SPEC §4):
  - cached ratings show at once,
  - the **first 10 distinct films per page load automatically**, the rest on a real hover (≥150 ms) or keyboard focus,
  - **no setting** for this ("nikdo to nebude řešit").
  - Earlier, "user action only" was chosen and then reversed by the owner; this is final.
- **Never circumvent ČSFD's Anubis bot protection.** No PoW, no spoofing, no hidden tabs. Polite client: cache, ≤2 concurrent, 400 ms spacing, queue cap, backoff on Anubis/429/503.
- **Name** kept with "ČSFD" first. **Colour (owner, 2026-11-01): exactly ČSFD red** `#ba0305` for the icon (gradient to `#7d0204`) and the UI accent (dark-mode heading `#f07a7c`). It replaces the v1.1.0 blue; the owner knowingly accepted the store/trademark risk (name + colour + rating context can look official). Mitigation: the "%" icon shape is unlike the ČSFD logo, and "unofficial" stays in all texts. Do not revert to blue without asking. Rating colours in badges are unchanged.
- **Firefox** declares `data_collection_permissions.required: ["websiteContent"]`, because film ids from visited pages go to csfd.cz. Honest disclosure.
- **`@types/node` stays on Node 22** (`.nvmrc`). Dependabot ignores its majors; CI fails on a mismatch.
- **VOD sites** (owner, 2026-10-31):
  - "everywhere" means all common VOD services on a curated list, **not** every website (the owner chose this twice),
  - look titles up via ČSFD search **only when a detail view is open**, never for browse tiles or automatically,
  - an uncertain match shows **„ČSFD ?“** linking to the ČSFD search, never a possibly wrong %,
  - one **generic detector** (document title ↔ on-page title, year next to the duration) on a **curated list of VOD hosts**, not on every site; per-site hints only where generic detection fails,
  - the badge goes next to the title; when there is no visible spot, it floats in the corner.
- **Shadow roots are `open`**, for testability and a11y. The content is public rating data.

## Open items (owner decides / acts)
0. **VOD before release:**
   - ~~the owner saves real ČSFD search pages~~ done 2026-11-01; the parser needed a fix for `/prehled/` links. Known limit: ČSFD has two films "Duna (2021)", so Villeneuve's Duna shows „ČSFD ?“ (never guess). If the owner wants a tie-breaker (e.g. ČSFD's result order or rating count), that is a SPEC change.
   - real-world check together in headed Chrome: ~8 titles per service (films, series, Czech titles, duplicate names); record the hit rate and whether `/hledat/` passes Anubis,
   - VOD is mentioned on the welcome page, in the store texts and the privacy texts (done 2026-11-01). Release v1.2.0 once the search parser passes the real pages (owner's decision 2026-11-01: the joint browser check is optional).
   - Sites added 2026-11-01 (owner: "as many as are used in CZ", no accounts there): Voyo SK, Canal+ (CZ/SK paths only), Rakuten TV, MUBI, KVIFF.TV, and **JustWatch** (an aggregator, added on the owner's explicit decision). Services surveyed and rejected, with reasons: [VOD fixture README](../tests/fixtures/pages/vod/README.md#services-considered-and-not-added-2026-11-01).
   - Sites added 2026-10-31 on the owner's request ("everywhere" = all common VOD services, still a curated list): Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+. The owner has no subscriptions there, so they were analysed on **public, logged-out** detail pages only; logged-in layouts may differ and need the real-world check. filmtoro.cz is not in the list: its detail pages link ČSFD directly, so the main script already badges them. Another site = `/add-vod-site` (one `VOD_SITES` entry + a fixture captured with `tools/capture-vod-page.mjs`).
   - Reviewer follow-ups: creators/users results have no `film-title-name` link and are already skipped (checked on the real pages); memoising search candidates per URL in the background is still open.
   - The 30-lookups-per-page-load cap also applies to long SPA sessions (Netflix never reloads). If the owner hits it in practice, revisit (e.g. a per-hour budget in the background instead).
1. Create store developer accounts and submit (CWS one-time fee, Edge Partner Center, AMO). Follow [launch-plan.md](launch-plan.md).
2. **Rating link in the popup:** add it once the store listing URLs exist (it needs per-store URLs). The owner wants only genuinely useful features. Onboarding is done (v1.1.0). The **uninstall survey was rejected** by the owner: don't add it.
3. Optionally send the drafted e-mail to ČSFD asking for consent or an API.
4. Replace the synthetic film fixtures in `tests/fixtures/csfd/` with real pages saved from a browser ([fixture README](../tests/fixtures/csfd/README.md)).
5. After the first manual store upload: automate submission from CI (credentials as GitHub secrets, gated environment).

## Gotchas
- **csfd.cz blocks automation:** curl and headless browsers get Anubis "Oh noes". Agents must not open csfd.cz themselves (the classifier blocks it, rightly). Ask the owner to check ČSFD pages by hand.
- `tests/fixtures/csfd/anubis-reject.html` is a **real** captured page (protected by a hook). The film fixtures are synthetic.
- **Localized store screenshots only render on Linux.** macOS Chrome ignores `--lang`. Use the **Store assets** workflow (Actions → Run workflow) and take its artifact.
- `element.focus()` from page scripts fires a *trusted* focus event. Keyboard intent therefore requires a real key press within 1 s (SPEC §4). E2E covers this.
- Agents may not run `wxt submit` (denied in `.claude/settings.json`).
- **VOD selectors break when the services redesign.** They live in `VOD_SITES` (`src/lib/vod/detect.ts`) with fixtures captured 2026-10-31. How to recapture, trimming pitfalls and the quirks of the generic sites: [VOD fixture README](../tests/fixtures/pages/vod/README.md). Quirks of the hinted sites:
  - Netflix: the detail is a modal (`?jbv=<id>` or `/title/<id>`), the logo has an empty `alt`, the title is in `.about-header strong`, the year of a series is its latest season;
  - HBO Max: `document.title` is English and wrapped in bidi isolates, the Czech title is the hero image `alt`;
  - Apple TV: the `h1` is visually hidden, JSON-LD has no Movie, and "2026 Oscar® Winner" sits next to the real year.
- **Playwright grants user activation by itself** shortly after load (and `page.evaluate` runs with a user gesture), so the §4b activation gate cannot be E2E-tested; unit tests and the manual check cover it.
- **Run E2E only via `pnpm test:e2e`.** It builds first; running `playwright test` directly tests a stale `.output/` build.
- **Invisible characters in source:** file edits by agents have turned `⁨`-style escapes into the literal invisible characters. Match them with Unicode classes (`\p{Cf}`, `\p{M}`) in source and build them with `String.fromCodePoint` in tests.
- **VOD content script is close to its budget** (6.91 of 7 kB gzip on 2026-11-01: about 90 B left). Each site entry costs bytes; raise the size-limit budget consciously, not silently.
- **Some sites refuse headless Chromium** (MUBI, JustWatch, Canal+: 403/503). Capture them with `--headed`; that is a normal browser, not a bypass.
- **Nightly VOD canary** (`.github/workflows/vod-canary.yml`, 03:17 UTC): checks 9 live public detail pages (Netflix, Disney+, HBO Max need a login; MUBI, JustWatch, Canal+ block headless browsers, which we don't get around). A gone or broken page opens/updates one issue labelled `canary` (mentions the owner); a green run closes it. "Unavailable" (outage, geo-block of the US runner) never alarms. GitHub pauses scheduled workflows after 60 days without a commit: re-enable under Actions. Prime Video shows Czech titles in a cs-CZ browser ("Hrozba smrti" = Road House 2024); the canary accepts both.
- **Trying it locally:** `pnpm build`, then *Load unpacked* `.output/chrome-mv3` (README). On VOD sites the rating loads only after the first click or key press on the page (user-activation gate).

## Where things are
`src/lib/` holds the logic (DI, pure). `src/entrypoints/` is thin wiring. `tests/unit` + `tests/e2e` + `tests/bench` + `tests/canary` (nightly live VOD check, `pnpm canary`). The Claude Code harness is in `.claude/` (hooks, path rules, reviewer subagents, skills `/add-url-pattern`, `/add-vod-site`, `/verify-in-browser`, `/release`). Tools: `tools/render-icons.mjs`, `tools/store-assets.mjs`, `tools/capture-vod-page.mjs`, `tools/canary-report.mjs`, `tools/biome/no-html-sinks.grit`.
