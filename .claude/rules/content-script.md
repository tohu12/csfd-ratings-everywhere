---
paths:
  - "src/entrypoints/content/**"
  - "src/lib/linkify.ts"
  - "src/lib/scanner.ts"
  - "src/lib/badge.ts"
  - "src/lib/csfd-url.ts"
---
# Content-script rules (runs on every page the user visits)

- Performance is a feature:
  - existing anchors via one native `querySelectorAll('a[href*="csfd." i]')`; text is walked only after one `mightContainCsfd(root.textContent)` check,
  - walk with `TreeWalker`, never `querySelectorAll('*')`,
  - process in idle chunks via the injected scheduler,
  - one shared `MutationObserver` and one `IntersectionObserver`.
- Never re-process the extension's own nodes. Everything we insert carries `data-csfd-linker`; mutation handling must ignore it, or the observer loops.
- Regexes:
  - no catastrophic backtracking (no nested quantifiers on overlapping classes),
  - global regexes are never module-level stateful objects reused across calls (reset `lastIndex` or use `matchAll`).
- Shadow roots are `open` (contents are public rating data; open roots stay inspectable by a11y tools and Playwright). HTML sinks, network and `customElements` are already blocked by Biome (see AGENTS.md table).
- Bundle budget: 8 kB gzip. No runtime dependencies.
