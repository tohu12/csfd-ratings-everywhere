# Project status

Handover note for agents and humans. **Keep it current.** Update it in the same change whenever status, a decision or an open item changes. Last updated: 2026-10-31 (v1.0.0).

## In one paragraph
"ČSFD hodnocení všude / ČSFD Ratings Everywhere" is a WXT MV3 browser extension (Chrome, Edge, Firefox).
- On any site except ČSFD itself, it finds ČSFD film URLs (plain text or `<a>`) and linkifies the plain-text ones.
- It shows the film's rating as a badge (default) or as a hover card.
- Behaviour is specified in [SPEC.md](../SPEC.md); architecture and rules are in [AGENTS.md](../AGENTS.md).
- Owner: Tomáš Hulek (GitHub `tohu12`), who communicates in Czech.

## State
| Area | State |
|---|---|
| Code | v1.0.0 tagged; `main` green. 307 unit tests at 100 % coverage, 9 Playwright E2E, size budgets, Firefox lint 0/0. |
| Real-world check | 2026-10-31, headed Chrome with the owner on 8 warcenter.cz topics: **8/8 correct**, incl. series-episode URLs and unrated films. Extension requests to csfd.cz **pass Anubis**. |
| Stores | **Not submitted yet.** Texts in [store-listing.md](store-listing.md), graphics in `docs/store/`, plan in [launch-plan.md](launch-plan.md). |
| Website | GitHub Pages from `/docs`: https://tohu12.github.io/csfd-ratings-everywhere/ (landing page + `PRIVACY.html`). |
| Release pipeline | Tag `v*` → `release.yml` builds Chrome/Edge/Firefox zips (+ Firefox sources zip) into a **draft** GitHub Release. Store upload is manual for now. |

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
- **Shadow roots are `open`**, for testability and a11y. The content is public rating data.

## Open items (owner decides / acts)
1. Create store developer accounts and submit (CWS one-time fee, Edge Partner Center, AMO). Follow [launch-plan.md](launch-plan.md).
2. Decide on proposed growth features: onboarding page on install, gentle rating prompt, uninstall feedback URL. They are described in the launch plan and **not implemented**.
3. Optionally send the drafted e-mail to ČSFD asking for consent or an API.
4. Replace the synthetic film fixtures in `tests/fixtures/csfd/` with real pages saved from a browser ([fixture README](../tests/fixtures/csfd/README.md)).
5. After the first manual store upload: automate submission from CI (credentials as GitHub secrets, gated environment).

## Gotchas
- **csfd.cz blocks automation:** curl and headless browsers get Anubis "Oh noes". Agents must not open csfd.cz themselves (the classifier blocks it, rightly). Ask the owner to check ČSFD pages by hand.
- `tests/fixtures/csfd/anubis-reject.html` is a **real** captured page (protected by a hook). The film fixtures are synthetic.
- **Localized store screenshots only render on Linux.** macOS Chrome ignores `--lang`. Use the **Store assets** workflow (Actions → Run workflow) and take its artifact.
- `element.focus()` from page scripts fires a *trusted* focus event. Keyboard intent therefore requires a real key press within 1 s (SPEC §4). E2E covers this.
- Agents may not run `wxt submit` (denied in `.claude/settings.json`).

## Where things are
`src/lib/` holds the logic (DI, pure). `src/entrypoints/` is thin wiring. `tests/unit` + `tests/e2e` + `tests/bench`. The Claude Code harness is in `.claude/` (hooks, path rules, reviewer subagents, skills `/add-url-pattern`, `/verify-in-browser`, `/release`). Tools: `tools/render-icons.mjs`, `tools/store-assets.mjs`, `tools/biome/no-html-sinks.grit`.
