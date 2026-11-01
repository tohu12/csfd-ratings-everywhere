# Privacy policy – ČSFD hodnocení všude / ČSFD Ratings Everywhere

_Last updated: 2026-11-01_

**Short version:** the extension collects no personal data, has no analytics, and sends nothing to its author or to any third party.

## What the extension does with data
- **Web pages you visit:** the content script reads page text locally in your browser to find links to ČSFD film pages. Only the film ids of those links are sent, to csfd.cz (see below); other page content never leaves your browser.
- **Streaming sites (Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání (Česká televize), Prima+, Voyo (Slovakia), Canal+, Rakuten TV, MUBI, KVIFF.TV and JustWatch):** when you open a film's or series' detail, the extension reads its title (from the page and from the tab title), year and type, and sends the title to csfd.cz as a search (see below).
- **Requests to csfd.cz:** to show a rating, the extension downloads that film's public page from `https://www.csfd.cz`. This happens automatically for the first 10 different films visible on a page, and for any other film when you hover its link or reach it with the keyboard. It is the same request your browser makes when you open the link: usual headers and your csfd.cz cookies. ČSFD therefore learns which films are linked on pages you view, just as if you had opened those links. ČSFD's own terms apply to these requests. Ratings are cached, so each film is requested at most once a week. On ordinary websites, web pages cannot trigger extra requests.
- **Searches on csfd.cz (streaming sites only):** to find the film whose detail you opened, the extension searches `https://www.csfd.cz/hledat/` for its title (at most twice, with the Czech and the original title), then downloads the film page as above. These requests also carry your csfd.cz cookies, so if you are logged in to ČSFD, ČSFD can link the titles whose details you open on these sites to your account. A search happens only after you have interacted with the page; browse rows and tiles never trigger one, and at most 30 titles are looked up per page load.
- **Stored locally:**
  - ratings cache (film id, rating, title) in `storage.local`, for up to 7 days,
  - title lookups (normalised title, year, type → ČSFD film id) in `storage.local`, for up to 30 days,
  - your settings (on/off, display mode, disabled sites) in `storage.sync`, which your browser may sync across your own devices,
  - two counters of ČSFD pages the extension could not read (to warn you when ČSFD changes its website) in `storage.local`. They are never sent anywhere; the optional "Report it" link opens a GitHub issue form with only the extension version and which kind of ČSFD page (film or search) failed, which you submit yourself.
  - You can clear the cache in the extension's settings.

## Permissions
| Permission | Why |
|---|---|
| Read page content on all sites (content script) | Find ČSFD links on any website you visit; on the streaming sites listed above also the open title's name, year and type. |
| `https://www.csfd.cz/*` | Download the public film page to read the rating (first 10 films per page automatically, others on hover/focus) and, on streaming sites, search for the title whose detail you opened. |
| `storage` | Cache ratings and keep your settings. |
| `activeTab` | Show the current site's on/off switch and link count in the popup. |

## Contact
Questions: open an issue at https://github.com/tohu12/csfd-ratings-everywhere/issues.

This extension is unofficial and is not affiliated with ČSFD.
