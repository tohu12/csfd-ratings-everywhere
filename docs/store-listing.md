# Store listing texts

Keep in sync with `public/_locales/*/messages.json` (`extName`, `extDescription`).

## Czech (primary)
**Name:** ČSFD hodnocení všude

**Short description (≤ 132 chars):** Neoficiální. Z odkazů na ČSFD na jakémkoli webu udělá klikatelné odkazy a ukáže u nich hodnocení filmu v procentech.

**Detailed description:**
Na fórech a webech se často objevují odkazy na ČSFD jen jako text. Toto rozšíření:
• z textových odkazů na ČSFD udělá klikatelné odkazy,
• u odkazu hned ukáže hodnocení filmu či seriálu v % v barvách ČSFD (na stránkách s mnoha filmy prvních 10 hned, ostatní po najetí myší),
• volitelně jen při najetí myší, bez jakéhokoli zásahu do vzhledu stránky,
• jde vypnout pro konkrétní weby.

Šetrné k ČSFD: každý film se stáhne jen jednou (i když je na stránce stokrát), hodnocení se ukládá do mezipaměti a počet požadavků je omezený.
Soukromí: žádná analytika, žádné sbírání dat. Rozšíření je neoficiální a není spojeno s ČSFD.

## Slovak
**Name:** ČSFD hodnotenie všade

## English
**Name:** ČSFD Ratings Everywhere

## Chrome Web Store – privacy tab
- Single purpose: show ČSFD film ratings next to ČSFD links on web pages.
- Host permission justification (`<all_urls>` content script): ČSFD links can appear on any website; the script only reads page text locally to find them.
- Host permission justification (`www.csfd.cz`): download the public film page to read its rating (first 10 distinct films visible on a page, others after the user hovers or keyboard-focuses the link).
- `storage`: rating cache and settings. `activeTab`: per-site switch in the popup.
- Data usage: no data collected by the developer. Requests to csfd.cz reveal to ČSFD which films are linked on pages the user views, as opening those links would. Remote code: none.
