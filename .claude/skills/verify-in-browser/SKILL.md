---
name: verify-in-browser
description: Verify the extension end-to-end in a real browser - production build, bundle budget, Playwright E2E, plus a manual checklist. Use before a release or after changes to content script, badge or background.
---

# Verify in browser

1. `pnpm build` then `pnpm size`. Both must pass; report the sizes.
2. `pnpm exec playwright test`. Report pass/fail. On failure, open `playwright-report/` and read the trace before changing code.
3. Print this manual checklist for the user. Agents must not script csfd.cz: Anubis blocks automation by design and we never circumvent it.
   - `pnpm dev` → open https://warcenter.cz/viewtopic.php?f=152&t=1691310 → the ČSFD URL is a link with a `ČSFD` badge; hovering it for a moment turns the badge into `NN %`.
   - Seriál/epizoda URL (t=1691306) → badge shows the episode rating.
   - A page with an existing `<a href="https://www.csfd.cz/film/...">` → badge appears, link unchanged.
   - Any page without ČSFD links → DevTools Performance shows no extension work beyond one check.
   - Popup: toggling the site off and reloading removes badges.
   - Service worker DevTools → Network: no request until you hover; each id fetched once; after reload the rating shows immediately from cache.
   - `pnpm dev:firefox`: same checks in Firefox.
