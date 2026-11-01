---
name: add-vod-site
description: Add a streaming (VOD) service to the curated list so its film/series detail pages show the ČSFD rating, end-to-end with a captured fixture and tests. Use when the owner asks to support a new streaming site or an existing site's detection broke after a redesign.
argument-hint: <service name> <public film detail URL> [series detail URL]
---

# Add a VOD site

Service and example URLs: $ARGUMENTS

Adding a site is an **owner decision** (SPEC §4b). Do it only when the owner asked for it.

1. **Survey.** Check that the service is live for CZ/SK, and find its public film and series detail URLs.
   - Note the detail URL shape and the URLs to ignore: episodes, seasons, people, genres, search.
   - A site whose detail pages **always link to ČSFD** needs nothing: the main content script badges those links, and the VOD script stays silent wherever a ČSFD film link is present. Add it only if some titles lack the link.
   - A site that is only reachable behind a login cannot be captured by an agent. Ask the owner to capture it logged in (fixture README), never type credentials.
2. **Capture** each page with `node tools/capture-vod-page.mjs <site>-film|series <url>`. See the [fixture README](../../../tests/fixtures/pages/vod/README.md) for these flags:
   - `--headed` for sites that refuse headless Chromium,
   - `--keep=header|dialog` when the title sits in one of those,
   - `--drop=<css>` for carousels that bloat the file or compete with the title.

   Never point it (or any browser automation) at ČSFD: the owner saves ČSFD pages by hand. The printed `h1` list must contain the title. Keep fixtures small (< ~70 kB). Grep them for e-mails or names before committing.
3. **Write the failing tests first** in `tests/unit/vod-detect.test.ts`:
   - a row in the generic table (`detectTitle on public pages…`), or an `it` in `detectTitle on real pages` for hinted sites,
   - negative paths in the `ignores non-detail paths` table,
   - the new host in the `matches` list in `tests/unit/entrypoints.test.ts`.

   Run them and confirm they fail.
4. **Add the `VOD_SITES` entry** in `src/lib/vod/detect.ts`:
   - Prefer generic detection, with only `host`, `brand` and `detailPath`.
   - Use per-site hints (`root`, `title`, `altTitle`, `year`, `meta`, `series`, `anchor`) only where generic detection picks the wrong element.
   - If the year or kind is missing because of a new text form (a duration spelled differently, a season word), extend the generic patterns, each with its own test in `detectTitle generic heuristics`. Do this rather than adding hints.
   - A missing year is acceptable: the lookup then goes by kind and only matches a unique title.
5. **Docs:**
   - the site list and path example in SPEC §4b,
   - the README (CZ and EN paragraphs), `docs/PRIVACY.md`, `docs/store-listing.md` (descriptions and the privacy tab),
   - the fixture README (table and quirks),
   - `docs/STATUS.md`,
   - CHANGELOG `## Unreleased`.
6. **Check:** run `pnpm check`, then `pnpm build && pnpm size`. The VOD content script budget is tight: say so if it grows past it, never raise it silently.
7. **Review:** run `code-reviewer`, `perf-reviewer` and `security-reviewer` (the manifest `matches` change) on the diff, and fix confirmed findings.
8. **Commit** as `feat(vod): support <service>`.
