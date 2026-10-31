# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repo. Humans: see README.md.

## What this is

A WXT (Manifest V3) browser extension for Chrome, Edge and Firefox. It linkifies ČSFD film URLs on any page and shows the film's rating, as an inline badge or a hover card.

Behaviour is specified in **SPEC.md**. Read it before changing behaviour and update it in the same change.

## Commands

- `pnpm check`: lint + typecheck + unit tests with coverage. **Must pass before you finish.**
- `pnpm test` / `pnpm test:watch`: Vitest unit tests (happy-dom, WXT fake browser).
- `pnpm test:e2e`: build + Playwright (loads the unpacked extension into Chromium).
- `pnpm bench`: performance benchmarks.
- `pnpm build && pnpm size`: production build + bundle size budget.
- `pnpm dev` / `pnpm dev:firefox`: dev browser with HMR.
- `pnpm format`: Biome autofix.

## Architecture

```
src/lib/            pure, framework-free core (no `browser.*`, no module-level state)
  csfd-url.ts       find/parse ČSFD URLs
  linkify.ts        DOM: text node → anchors, find existing links
  scanner.ts        DOM walking, chunking, MutationObserver orchestration
  badge.ts          shadow-DOM badge rendering + shared badge view model
  hover-card.ts     single floating shadow-DOM card (tooltip display mode)
  content-app.ts    content-script composition: scanner + badge/tooltip decorator
  rating.ts         Rating types + colour classification
  rating-parser.ts  ČSFD HTML → Rating | blocked
  rating-service.ts background orchestration: cache → backoff → queue → fetch → parse
  queue.ts          concurrency + spacing limiter
  cache.ts          TTL + LRU-bounded cache over a key-value store
  messages.ts       typed content↔background protocol + runtime guards
  settings.ts       settings shape, defaults, normalisation, host matching
  i18n.ts           typed wrapper over browser.i18n
  background-app.ts background composition + message handler
  popup-app.ts, options-app.ts  extension pages
src/platform/       the few helpers that touch `browser.*` directly
src/entrypoints/    thin wiring only: inject real browser APIs into lib/ factories
```
Rules:
- **Dependency injection.** lib/ factories take their side effects (`fetch`, storage, clock, scheduler, observers) as parameters. Entry points wire real implementations; tests wire fakes.
- **Data flows one way:** content → `runtime.sendMessage` → background → cache/queue → fetch → parser. Content scripts never touch the network.
- **Trust nothing at boundaries:** messages, storage values and ČSFD HTML go through runtime guards (`messages.ts`, `settings.ts`, `cache.ts`). No `as` casts on external data.
- **No runtime dependencies.** The content script runs on every page; keep it tiny (≤ 8 kB gzip, enforced by size-limit).

## Machines first, agents second

Whatever a deterministic tool can check is checked by the tool. It is **not** an agent's job, and AI reviewers must not report it.

| Concern | Enforced by |
|---|---|
| formatting, import order, unused code, `any`, `!`, `console.log` | Biome (`pnpm lint`), PostToolUse hook, lefthook |
| `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` in `src/` | Biome GritQL plugin `tools/biome/no-html-sinks.grit` |
| `fetch`/`XMLHttpRequest`/`localStorage`/`customElements` in content-script modules | Biome `noRestrictedGlobals` override |
| floating promises | Biome `noFloatingPromises` |
| `test.only` / `.skip` | Biome `noFocusedTests` / `noSkippedTests` |
| types, strictness | `tsc` (`pnpm typecheck`) |
| behaviour, regressions | Vitest; 100 % coverage threshold |
| bundle budgets | size-limit (`pnpm size`) |
| runtime dependencies (must be none) | CI step |
| real-browser behaviour, incl. "page scripts cannot trigger requests", tooltip hiding | Playwright E2E |
| Conventional Commits | lefthook `commit-msg` |

If you find a recurring review issue that a tool could catch, add the rule or test instead of a sentence here.

## Rules no tool can check (agent responsibility)

- Never circumvent ČSFD bot protection (Anubis): no PoW solving, no UA/header spoofing, no hidden tabs or iframes, no traffic beyond SPEC §4. If blocked, degrade gracefully (SPEC §6).
- csfd.cz is contacted only as SPEC §4 allows: the first 10 distinct visible films per page, plus real user actions. Never raise the cap or add prefetching, "warm-up" or bulk loading without the owner's decision.
- Never add permissions or host permissions without updating SPEC §8, README and docs/PRIVACY.md.
- Behaviour matches SPEC.md. Architecture follows the rules above (DI, one-way data flow, guards at boundaries).
- Tests assert behaviour, not implementation, and never hit the real network. ČSFD responses come from `tests/fixtures/csfd/`.

## Testing

- **100 % coverage** (lines, branches, functions, statements) of `src/` is enforced. Write the test first (TDD); every new branch needs a test.
- Unit tests live in `tests/unit/<module>.test.ts`, mirroring `src/`.
- Use the injected fakes: `fakeBrowser` from `wxt/testing/fake-browser` for browser APIs, fake clocks/schedulers for timing. No real timers in tests (use `vi.useFakeTimers()` where needed).
- Fixtures:
  - `tests/fixtures/pages/` for host pages,
  - `tests/fixtures/csfd/` for ČSFD responses. `anubis-reject.html` is a real ČSFD Anubis page; the film fixtures are synthetic until replaced by pages saved from a real browser (see the fixture README).

## Conventions

- TypeScript strict (+ `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). No `any`, no non-null `!`.
- Biome formats and lints. Do not hand-format.
- Named exports only (entry points excepted: WXT requires `export default`).
- Commits: Conventional Commits (`feat(content): …`, `fix(background): …`), enforced by lefthook.
- Keep changes small and focused; one concern per PR.
