# Project status

Handover note for agents and humans. **Keep it current.** Update it in the same change whenever status, a decision or an open item changes. Last updated: 2026-10-31 (v1.1.0).

## In one paragraph
"ČSFD hodnocení všude / ČSFD Ratings Everywhere" is a WXT MV3 browser extension (Chrome, Edge, Firefox).
- On any site except ČSFD itself, it finds ČSFD film URLs (plain text or `<a>`) and linkifies the plain-text ones.
- It shows the film's rating as a badge (default) or as a hover card.
- Behaviour is specified in [SPEC.md](../SPEC.md); architecture and rules are in [AGENTS.md](../AGENTS.md).
- Owner: Tomáš Hulek (GitHub `tohu12`), who communicates in Czech.

## State
| Area | State |
|---|---|
| Code | v1.1.0 released (welcome page, blue UI accent). **`main` adds VOD ratings (SPEC §4b), unreleased:** Netflix, Disney+, HBO Max, Apple TV detail views → ČSFD search → rating. 436 unit tests at 100 % coverage, 13 Playwright E2E, size budgets (VOD script 5.4 / 6 kB). Reviewed by code-, perf- and security-reviewer; confirmed findings fixed. |
| VOD real-world check | **Not done yet.** Detection verified on DOM captured 2026-10-31 from the owner's logged-in sessions (`tests/fixtures/pages/vod/`). The search parser is tested only on a **synthetic** ČSFD search page. Unknown: whether `/hledat/` requests pass Anubis like `/film/` ones. |
| Real-world check | 2026-10-31, headed Chrome with the owner on 8 warcenter.cz topics: **8/8 correct**, incl. series-episode URLs and unrated films. Extension requests to csfd.cz **pass Anubis**. |
| Stores | **Not submitted yet.** Texts in [store-listing.md](store-listing.md), graphics in `docs/store/`, plan in [launch-plan.md](launch-plan.md). |
| Website | GitHub Pages from `/docs`: https://tohu12.github.io/csfd-ratings-everywhere/ (landing page + `PRIVACY.html`). |
| Release pipeline | Tag `v*` → `release.yml` builds Chrome/Edge/Firefox zips (+ Firefox sources zip) into a **draft** GitHub Release. Store upload is manual for now. |
| Store packages | Use the **v1.1.0** release zips (v1.0.0 predates the UI colour change and the welcome page). |

## Decisions (and why). Don't revert without asking the owner
- **Fetching** (SPEC §4):
  - cached ratings show at once,
  - the **first 10 distinct films per page load automatically**, the rest on a real hover (≥150 ms) or keyboard focus,
  - **no setting** for this ("nikdo to nebude řešit").
  - Earlier, "user action only" was chosen and then reversed by the owner; this is final.
- **Never circumvent ČSFD's Anubis bot protection.** No PoW, no spoofing, no hidden tabs. Polite client: cache, ≤2 concurrent, 400 ms spacing, queue cap, backoff on Anubis/429/503.
- **Name** kept with "ČSFD" first; the **icon was recoloured blue** so it does not look like the ČSFD logo.
- **Firefox** declares `data_collection_permissions.required: ["websiteContent"]`, because film ids from visited pages go to csfd.cz. Honest disclosure.
- **`@types/node` stays on Node 22** (`.nvmrc`). Dependabot ignores its majors; CI fails on a mismatch.
- **VOD sites** (owner, 2026-10-31):
  - look titles up via ČSFD search **only when a detail view is open**, never for browse tiles or automatically,
  - an uncertain match shows **„ČSFD ?“** linking to the ČSFD search, never a possibly wrong %,
  - one **generic detector** (document title ↔ on-page title, year next to the duration) on a **curated list of VOD hosts**, not on every site; per-site hints only where generic detection fails,
  - the badge goes next to the title; when there is no visible spot, it floats in the corner.
- **Shadow roots are `open`**, for testability and a11y. The content is public rating data.

## Open items (owner decides / acts)
0. **VOD before release:**
   - the owner saves real ČSFD search pages (`/hledat/?q=silo`, `?q=duna`) into `tests/fixtures/csfd/` and the parser is checked against them,
   - real-world check together in headed Chrome: ~8 titles per service (films, series, Czech titles, duplicate names); record the hit rate and whether `/hledat/` passes Anubis,
   - then mention VOD on the welcome page and in the store texts (privacy texts are already updated), and release v1.2.0.
   - More sites (Prime Video, SkyShowtime, Oneplay, Voyo, iVysílání): the owner decides; each is one entry in `VOD_SITES` + a captured fixture.
   - Reviewer follow-ups that need the real search page: restrict `parseSearchPage` to the film/series result sections; consider memoising search candidates per URL in the background.
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
- **VOD selectors break when the services redesign.** They live in `VOD_SITES` (`src/lib/vod/detect.ts`) with fixtures captured 2026-10-31. To refresh: headed browser via Playwright MCP, the owner logs in, capture the detail container's `outerHTML` (strip images, svg paths, styles). Quirks seen:
  - Netflix: the detail is a modal (`?jbv=<id>` or `/title/<id>`), the logo has an empty `alt`, the title is in `.about-header strong`, the year of a series is its latest season;
  - HBO Max: `document.title` is English and wrapped in bidi isolates, the Czech title is the hero image `alt`;
  - Apple TV: the `h1` is visually hidden, JSON-LD has no Movie, and "2026 Oscar® Winner" sits next to the real year.
- **Playwright grants user activation by itself** shortly after load (and `page.evaluate` runs with a user gesture), so the §4b activation gate cannot be E2E-tested; unit tests and the manual check cover it.

## Where things are
`src/lib/` holds the logic (DI, pure). `src/entrypoints/` is thin wiring. `tests/unit` + `tests/e2e` + `tests/bench`. The Claude Code harness is in `.claude/` (hooks, path rules, reviewer subagents, skills `/add-url-pattern`, `/verify-in-browser`, `/release`). Tools: `tools/render-icons.mjs`, `tools/store-assets.mjs`, `tools/biome/no-html-sinks.grit`.
