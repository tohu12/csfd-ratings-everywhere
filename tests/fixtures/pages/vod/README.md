# VOD page fixtures

Detail pages of streaming services, used by `tests/unit/vod-detect.test.ts` and `vod-app.test.ts`, and by the E2E Netflix mock. Each file starts with a comment giving its source URL, the capture date and whether the session was logged in.

| files | origin |
|---|---|
| `netflix-*`, `disney-*`, `hbomax-*` | Owner's logged-in cs-CZ sessions, 2026-10-31. Only the detail container was kept. |
| `appletv-film`, `prime-*`, `skyshowtime-*`, `oneplay-series`, `ct-*`, `prima-film` | Public pages, **logged out**, 2026-10-31. The owner has no subscription; logged-in layouts may differ. |
| `voyo-sk-*`, `canalplus-*`, `rakuten-film`, `mubi-film`, `kviff-film`, `justwatch-*` | Public pages, **logged out**, 2026-11-01, captured with `tools/capture-vod-page.mjs`. No subscriptions; logged-in layouts may differ. |
| `ct-category` | A negative case: a category page whose heading matches the document title. It must not be detected. |
| `netflix-scripted` | E2E only: a page that opens the detail modal from a script. |

## Capturing a page

**Public (logged-out) pages:** use the tool. It renders the page, trims it as described below and writes the fixture with its header comment:

```sh
node tools/capture-vod-page.mjs mubi-film https://mubi.com/en/cz/films/perfect-days --headed
```

- `--headed` opens a real window. MUBI, JustWatch and Canal+ answer 403/503 to headless Chromium.
- `--keep=header` / `--keep=dialog` when the title sits there (Oneplay, Canal+: `header`; KVIFF.TV, Rakuten TV: the detail is a `role="dialog"`).
- `--drop=<css>` for "more titles" carousels that bloat the file or compete with the title (Voyo: `section.c-section`; Rakuten: the catalogue behind the modal and the OneTrust banner).
- The tool refuses csfd.cz/csfd.sk (also after a redirect) and strips query strings from links (tracking ids).
- Check the printed `h1` list: an empty list usually means the title was inside a removed section.

**Logged-in pages:** the owner the detail in a headed browser (Playwright MCP) and logs in themselves. Agents never type credentials. Then run this in the page:

```js
() => {
  const d = document.documentElement.cloneNode(true);
  d.querySelectorAll('script:not([type="application/ld+json"]),style,link,noscript,iframe,video,source,template').forEach((e) => e.remove());
  d.querySelectorAll('svg').forEach((s) => s.replaceChildren());
  d.querySelectorAll('*').forEach((e) => {
    for (const a of [...e.attributes]) {
      if (/^(src|srcset|style|sizes|data-src|data-srcset|on\w+)$/.test(a.name)) e.removeAttribute(a.name);
    }
  });
  d.querySelectorAll('head meta').forEach((m) => {
    if (!/^og:/.test(m.getAttribute('property') || '') && m.getAttribute('charset') === null) m.remove();
  });
  return { url: location.href, html: '<!doctype html>\n' + d.outerHTML };
};
```

Then trim the result with happy-dom before saving it:
- Remove `header, footer, nav`, `[role="dialog"]` and cookie banners (`[id*=cookie i], [class*=cookie i]`).
- Keep only the attributes the detector reads: `id`, short `class`, `alt`, `href`, `data-testid`, `data-uia`, `data-automation-id`, `property`, `content`, `type`, `aria-hidden`, `dir`, `role`, `lang`.
- **Remove no personal data:** profile names, e-mails, avatars, "continue watching" rows. Search the file before committing.
- Add the comment line with the URL, the date and logged in/out.

Pitfalls seen while trimming (check that the title, year and duration are still in the file):
- Some sites put a `cookie` class on the page wrapper. Remove only matches without an `h1`/`h2` inside.
- Oneplay renders the title and metadata **inside `<header>`**. Keep the header there.
- Prima+ has "more titles" strips (`.strip-title` sections). Drop those sections, or their headings compete with the real title.

## Quirks of the services (beyond those in docs/STATUS.md)

- **Prime Video:** the hero backdrop `img` has the same `alt` as the title. On a tie the detector prefers the element inside a heading.
- **Recommendation tiles** can carry a shorter title, e.g. "Road House" on the "Road House 2" page. Tiles are links, which the detector ignores.
- **iVysílání ČT:** shows no year on series pages, so the lookup goes by kind only. Category pages look like details; only `/porady/<id>-<name>/` counts as one.
- **SPA navigation** can leave the previous title's JSON-LD in the page. It is trusted only when the document title starts with its name.
- Episode pages (JSON-LD `TVEpisode`/`TVSeason`) are never detected.

## Services considered and not added (2026-11-01)

Surveyed logged out (curl + headless/headed Chromium). Revisit if the situation changes.

| Service | Why not |
|---|---|
| Voyo CZ, O2 TV | Redirect to Oneplay (already supported). |
| DAFilms, Filmtoro, SledovaniTV (TV/series details), Lepší.TV (marketing pages) | Already link to ČSFD: the main content script badges those links. |
| Kuki, Telly, Magenta TV (T-Mobile), Magio GO | Behind a login, empty app shell when logged out. |
| JOJ Play | Logged out, detail URLs only redirect; mostly JOJ's own shows. |
| STVR archive | Pages are single broadcasts: no production year, films marked up as TVEpisode. |
| FilmBox+, Google Play Filmy | Not available in Czechia. |
| Paramount+ | Not standalone in Czechia; its catalogue is on SkyShowtime. |
| YouTube (films) | One `/watch` URL for all videos; no reliable film marker. |

## Quirks of the services added on 2026-11-01

- **Voyo SK** (like Prima+ and Oneplay) shows its own ČSFD link next to the title; the VOD script then stays silent and the main script badges that link. The fixtures keep the link; `detectTitle` tests ignore it, and `vod-app.test.ts` covers the silent case.
- **Voyo SK:** `/filmy/…` and `/serialy/…` redirect to `/titul/<id>-<slug>`. Series show an episode-length range ("2026 48 - 53m"). Raw HTML from curl has "2. séria | Hriech | Voyo" as the title; the rendered page does not.
- **Canal+:** global host, only `/cz|sk/<lang>/filmy|serialy/<slug>/h/<id>` counts. Duration is written "2h52"; series show no year. The `h1` contains a link to the page itself (the title is still found).
- **Rakuten TV:** the detail is a modal over the catalogue at `/cz?content_type=movies&content_id=<slug>`; no path filter. The title comes from the poster `img[alt]`.
- **MUBI:** English UI only (`/cs/…` redirects to `/en/cz/…`), titles in caps; the year comes from "(2023)" in the document title.
- **KVIFF.TV** (formerly Aerovod): films only; the year ("Norsko, 2024") is not next to the duration, so the lookup goes by kind only.
- **JustWatch:** an aggregator. The document title is marketing text ("Sledování titulu Oppenheimer: kde sledovat film online?") and an `h2` repeats it, so it uses hints, with "Původní název:" as the second title.

Run `pnpm test` after replacing a fixture. A failure means the service changed its layout: update its `VOD_SITES` entry in `src/lib/vod/detect.ts`.
