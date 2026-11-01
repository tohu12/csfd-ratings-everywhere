# VOD page fixtures

Detail pages of streaming services, used by `tests/unit/vod-detect.test.ts` and `vod-app.test.ts`, and by the E2E Netflix mock. Each file starts with a comment giving its source URL, the capture date and whether the session was logged in.

| files | origin |
|---|---|
| `netflix-*`, `disney-*`, `hbomax-*` | Owner's logged-in cs-CZ sessions, 2026-10-31. Only the detail container was kept. |
| `appletv-film`, `prime-*`, `skyshowtime-*`, `oneplay-series`, `ct-*`, `prima-film` | Public pages, **logged out**, 2026-10-31. The owner has no subscription; logged-in layouts may differ. |
| `ct-category` | A negative case: a category page whose heading matches the document title. It must not be detected. |
| `netflix-scripted` | E2E only: a page that opens the detail modal from a script. |

## Capturing a page

The owner opens the detail in a headed browser (Playwright MCP) and logs in themselves. Agents never type credentials. Then run this in the page:

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

Run `pnpm test` after replacing a fixture. A failure means the service changed its layout: update its `VOD_SITES` entry in `src/lib/vod/detect.ts`.
