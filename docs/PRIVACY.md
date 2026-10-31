# Privacy policy – ČSFD hodnocení všude / ČSFD Ratings Everywhere

_Last updated: 2026-10-31_

**Short version:** the extension collects no personal data, has no analytics, and sends nothing to its author or to any third party.

## What the extension does with data
- **Web pages you visit:** the content script reads page text locally in your browser, only to find links to ČSFD film pages. Page content never leaves your browser.
- **Requests to csfd.cz:** to show a rating, the extension downloads that film's public page from `https://www.csfd.cz`. This happens automatically for the first 10 different films visible on a page, and for any other film when you hover its link or reach it with the keyboard. It is the same request your browser makes when you open the link: usual headers and your csfd.cz cookies. ČSFD therefore learns which films are linked on pages you view, just as if you had opened those links. ČSFD's own terms apply to these requests. Ratings are cached, so each film is requested at most once a week. Web pages cannot trigger extra requests.
- **Stored locally:**
  - ratings cache (film id, rating, title) in `storage.local`, for up to 7 days,
  - your settings (on/off, display mode, disabled sites) in `storage.sync`, which your browser may sync across your own devices.
  - You can clear the cache in the extension's settings.

## Permissions
| Permission | Why |
|---|---|
| Read page content on all sites (content script) | Find ČSFD links on any website you visit. |
| `https://www.csfd.cz/*` | Download the public film page to read the rating (first 10 films per page automatically, others on hover/focus). |
| `storage` | Cache ratings and keep your settings. |
| `activeTab` | Show the current site's on/off switch and link count in the popup. |

## Contact
Questions: open an issue at https://github.com/tohu12/csfd-ratings-everywhere/issues.

This extension is unofficial and is not affiliated with ČSFD.
