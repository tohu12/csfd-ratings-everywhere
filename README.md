# ČSFD hodnocení všude · ČSFD Ratings Everywhere

[![CI](https://github.com/tohu12/csfd-ratings-everywhere/actions/workflows/ci.yml/badge.svg)](https://github.com/tohu12/csfd-ratings-everywhere/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Česky:** Rozšíření pro Chrome, Edge a Firefox. Na jakémkoli webu najde odkazy na ČSFD, ať jsou to jen text nebo už odkazy. Textové odkazy udělá klikatelné. U odkazu hned ukáže hodnocení filmu v procentech (na stránkách s mnoha filmy prvních 10 hned, ostatní po najetí myší), jako malý odznak nebo jako plovoucí kartu. Na Netflixu, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, slovenském Voyo, Canal+, Rakuten TV, MUBI, KVIFF.TV a JustWatch ukáže hodnocení u otevřeného detailu filmu nebo seriálu (dohledá ho podle názvu a roku; když si není jistý, ukáže „ČSFD ?“ s odkazem na hledání). Neoficiální projekt, není spojen s ČSFD.

A browser extension for Chrome, Edge and Firefox. It turns ČSFD film URLs on **any** website into clickable links and shows the film's ČSFD rating next to them. Unofficial; not affiliated with ČSFD.

```
Before:  https://www.csfd.cz/film/1700849-coutures/prehled/
After:   https://www.csfd.cz/film/1700849-coutures/prehled/ [65 %]
                 ↑ clickable                                  ↑ ČSFD colours, tooltip with title + count
```

## Features
- Detects ČSFD URLs in plain text and in existing links, including series → season → episode URLs (`/film/<series>/<episode>/`).
- **Streaming sites:** on Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání (Česká televize), Prima+, Voyo (Slovakia), Canal+, Rakuten TV, MUBI, KVIFF.TV and JustWatch, opening a film's or series' detail shows its ČSFD rating, found by title and year via ČSFD search. When the match is not certain, it shows **ČSFD ?** linking to the ČSFD search instead of guessing. Browse rows never trigger requests.
- Two display modes: **badge** (default) or **hover card**, which inserts nothing into the page layout.
- **Shows ratings right away:** cached ratings appear instantly; the first 10 distinct films on a page load automatically, any others when you hover a link (150 ms) or tab to it. 100 links to the same film = 1 request. Web pages cannot trigger extra requests (on streaming sites a lookup needs your interaction with the page).
- Polite to ČSFD:
  - cache (7 days),
  - max 2 parallel requests, 400 ms spacing, bounded queue,
  - automatic pause when ČSFD asks to slow down (bot protection, HTTP 429/503 with `Retry-After`).
- Per-site and global on/off switch, Czech/Slovak/English UI.
- Tiny and fast: content script ≈ 5 kB gzipped, no runtime dependencies.
- Private: no analytics, nothing sent anywhere except requests to csfd.cz. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Install
- **Stores:** coming soon (Chrome Web Store, Edge Add-ons, Firefox Add-ons).
- **From source:** `pnpm install && pnpm build`, then in `chrome://extensions` enable *Developer mode* → *Load unpacked* → `.output/chrome-mv3`.

> If a badge shows **ČSFD !**, ČSFD did not return the rating right now (e.g. its bot protection answered). The extension pauses and lets you try again later; it never tries to bypass this protection.

## Development
Requirements: Node 22 (`.nvmrc`), pnpm 11.

```bash
pnpm install          # also installs git hooks (lefthook)
pnpm dev              # Chrome with the extension + HMR
pnpm dev:firefox      # Firefox
pnpm check            # lint + typecheck + unit tests (100 % coverage enforced)
pnpm test:e2e         # build + Playwright against the real extension in Chromium
pnpm bench            # performance budgets
pnpm build && pnpm size
pnpm lint:firefox     # Firefox build + web-ext lint
```

| Path | What |
|---|---|
| `src/lib/` | Framework-free core with dependency injection. All logic lives here. |
| `src/entrypoints/` | Thin WXT entry points (background, content script, popup, options). |
| `tests/unit/` | Vitest + happy-dom + WXT fake browser. |
| `tests/e2e/` | Playwright with the built extension. ČSFD is always mocked. |
| `tests/fixtures/` | Host pages and ČSFD responses ([how to refresh them](tests/fixtures/csfd/README.md)). |
| `SPEC.md` | Behaviour specification: the source of truth. |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Instructions and harness for AI coding agents. |

### Quality gates
Every change must pass, locally (hooks) and in CI:
- Biome lint + format, including custom rules: no HTML-string sinks, no network or `customElements` in content-script modules, no floating promises, no focused or skipped tests.
- `tsc` strict.
- Vitest with **100 %** line/branch/function/statement coverage.
- Playwright E2E.
- Bundle size budget.
- `web-ext lint`.
- Conventional Commits.

### Working with AI agents
The repo is set up for Claude Code (and other agents via `AGENTS.md`):
- hooks format every edit and block finishing while tests fail,
- read-only reviewer subagents (`code-reviewer`, `perf-reviewer`, `security-reviewer`),
- skills for recurring tasks (`/add-url-pattern`, `/verify-in-browser`, `/release`).

The principle: **whatever a tool can check is checked by the tool**. Agents and reviewers focus on behaviour, architecture and SPEC conformance.

## Contributing
Issues and PRs welcome. Please read [SPEC.md](SPEC.md) and [AGENTS.md](AGENTS.md) first, keep PRs small, and run `pnpm check`.

## License
[MIT](LICENSE) © Tomas Hulek. "ČSFD" is a trademark of its owner, used here only to describe compatibility.
