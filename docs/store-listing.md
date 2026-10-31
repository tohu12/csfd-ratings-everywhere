# Store listing texts

Keep in sync with `public/_locales/*/messages.json` (`extName`, `extDescription`).

## Czech (primary)
**Name:** ČSFD hodnocení všude

**Short description (≤ 132 chars):** Neoficiální. Z odkazů na ČSFD na jakémkoli webu udělá klikatelné odkazy a ukáže u nich hodnocení filmu v procentech.

**Detailed description:**
Na fórech a webech se často objevují odkazy na ČSFD jen jako text. Toto rozšíření:
• z textových odkazů na ČSFD udělá klikatelné odkazy,
• po najetí myší na odkaz ukáže hodnocení filmu či seriálu v % v barvách ČSFD (už jednou zobrazená hodnocení pak vidíš hned),
• volitelně jen při najetí myší, bez jakéhokoli zásahu do vzhledu stránky,
• jde vypnout pro konkrétní weby.

Šetrné k ČSFD: hodnocení se načítá jen, když na odkaz najedeš myší nebo se na něj dostaneš klávesnicí, ukládá se do mezipaměti a požadavky jsou omezené.
Soukromí: žádná analytika, žádné sbírání dat. Rozšíření je neoficiální a není spojeno s ČSFD.

## Slovak
**Name:** ČSFD hodnotenie všade

## English
**Name:** ČSFD Ratings Everywhere

## Chrome Web Store – privacy tab
- Single purpose: show ČSFD film ratings next to ČSFD links on web pages.
- Host permission justification (`<all_urls>` content script): ČSFD links can appear on any website; the script only reads page text locally to find them.
- Host permission justification (`www.csfd.cz`): download the public film page to read its rating, only after the user hovers or keyboard-focuses that link.
- `storage`: rating cache and settings. `activeTab`: per-site switch in the popup.
- Data usage: no data collected by the developer. A user-triggered request to csfd.cz reveals to ČSFD which film the user hovered, as opening the link would. Remote code: none.
