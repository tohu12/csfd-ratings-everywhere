# Store listing – copy-paste texts

Keep in sync with `public/_locales/*/messages.json` (`extName`, `extDescription`). Graphics live in `docs/store/`; regenerate them with the **Store assets** workflow (Actions → Run workflow). It renders the correct cs/en UI on Linux.

## URLs (all stores)

| Field | Value |
|---|---|
| Website / homepage | https://tohu12.github.io/csfd-ratings-everywhere/ |
| Support | https://github.com/tohu12/csfd-ratings-everywhere/issues |
| Privacy policy | https://tohu12.github.io/csfd-ratings-everywhere/PRIVACY.html |
| Source code (AMO) | https://github.com/tohu12/csfd-ratings-everywhere |

## Graphics

| Asset | File | Where |
|---|---|---|
| Store icon 128×128 (96 px art + 16 px padding) | `public/icon/128.png` | CWS, Edge, AMO (AMO takes the icon from the package) |
| Screenshots 1280×800, max 5, order 1→5 (5 = streaming sites: a fictional page, only Netflix · Disney+ · HBO Max + "and more" as text, no logos) | `docs/store/screenshot-{1..5}-*-{cs,en}.png` | CWS (per locale), Edge, AMO |
| Small promo tile 440×280 | `docs/store/promo-small-440x280.png` | CWS (required), Edge |
| Marquee 1400×560 | `docs/store/promo-marquee-1400x560.png` | CWS (used only if featured) |

## Czech (primary listing)

> **Never list all the streaming services in store metadata** (description, screenshots, promo tiles). Chrome Web Store rejected v1.3.1 for keyword spam ("Yellow Argon", handled 2026-11-06) because of the 15-name list. Name at most Netflix, Disney+ and HBO Max, once, and point to the website for the full list.

**Name (≤ 75):** ČSFD hodnocení všude

**Summary (≤ 132, = `extDescription`, Chrome takes it from the manifest):** Hodnocení ČSFD hned u odkazů na jakémkoli webu i u filmů a seriálů na Netflixu, Disney+, HBO Max a dalších službách.

**Description:**
```
Hodnocení ČSFD uvidíte hned tam, kde se o filmu mluví: u odkazů na ČSFD na fórech, v diskuzích, na blozích i na Facebooku a u filmů a seriálů na Netflixu, Disney+, HBO Max a dalších streamovacích službách.

• Textové odkazy na ČSFD udělá klikatelné, včetně seriálů a epizod.
• U odkazu ukáže hodnocení filmu v % v barvách ČSFD a po najetí myší i název a počet hodnocení.
• Prvních 10 filmů na stránce se načte hned, ostatní po najetí myší.
• Zobrazení si vyberete: malý odznak u odkazu, nebo jen plovoucí karta (nic se nevkládá do stránky).
• Na streamovacích službách ukáže hodnocení u otevřeného detailu filmu nebo seriálu. Seznam podporovaných služeb najdete na webu rozšíření. Když si není jistý, ukáže „ČSFD ?“ s odkazem na hledání.
• Na libovolném webu jde vypnout jedním kliknutím.
• Česky, slovensky a anglicky.

Šetrné k ČSFD i k vašemu prohlížeči: každý film se stáhne jen jednou, hodnocení se ukládají do mezipaměti, počet požadavků je omezený a rozšíření je malé a rychlé.

Soukromí: žádná analytika ani sběr dat. Hodnocení se čte přímo z csfd.cz a ukládá jen ve vašem prohlížeči. Zdrojový kód je otevřený (MIT).

Neoficiální rozšíření, není spojeno s ČSFD.
```

## Slovak

**Name:** ČSFD hodnotenie všade

**Summary:** Hodnotenie ČSFD hneď pri odkazoch na akomkoľvek webe aj pri filmoch a seriáloch na Netflixe, Disney+, HBO Max a inde.

**Description:**
```
Hodnotenie ČSFD uvidíte hneď tam, kde sa o filme hovorí: pri odkazoch na ČSFD na fórach, v diskusiách, na blogoch aj na Facebooku a pri filmoch a seriáloch na Netflixe, Disney+, HBO Max a ďalších streamovacích službách.

• Textové odkazy na ČSFD urobí klikateľné, vrátane seriálov a epizód.
• Pri odkaze ukáže hodnotenie filmu v % vo farbách ČSFD a po prejdení myšou aj názov a počet hodnotení.
• Prvých 10 filmov na stránke sa načíta hneď, ostatné po prejdení myšou.
• Zobrazenie si vyberiete: malý odznak pri odkaze, alebo len plávajúca karta (nič sa nevkladá do stránky).
• Na streamovacích službách ukáže hodnotenie pri otvorenom detaile filmu alebo seriálu. Zoznam podporovaných služieb nájdete na webe rozšírenia. Keď si nie je istý, ukáže „ČSFD ?“ s odkazom na vyhľadávanie.
• Na ľubovoľnom webe sa dá vypnúť jedným kliknutím.

Šetrné k ČSFD aj k vášmu prehliadaču: každý film sa stiahne len raz, hodnotenia sa ukladajú do vyrovnávacej pamäte a počet požiadaviek je obmedzený.

Súkromie: žiadna analytika ani zber dát. Otvorený zdrojový kód (MIT). Neoficiálne rozšírenie, nie je spojené s ČSFD.
```

## English

**Name:** ČSFD Ratings Everywhere

**Summary:** See ČSFD ratings next to links on any website and on films and series on Netflix, Disney+, HBO Max and other services.

**Description:**
```
See ČSFD ratings right where films come up: next to ČSFD links in forums, discussions, blogs and on Facebook, and on films and series on Netflix, Disney+, HBO Max and other streaming services.

• Turns plain-text ČSFD URLs into clickable links, including series and episodes.
• Shows the film's ČSFD rating in % in ČSFD's colours, with the title and number of ratings on hover.
• The first 10 films on a page load right away; others when you hover.
• Choose how it looks: a small badge next to the link, or a hover card only (nothing is inserted into the page).
• On streaming sites it shows the rating of the open film or series. The supported services are listed on the extension's website. When unsure, it shows "ČSFD ?" linking to the search.
• Turn it off for any site with one click.
• Czech, Slovak and English.

Light on ČSFD and on your browser: each film is fetched once, ratings are cached, requests are rate-limited, and the extension is tiny.

Privacy: no analytics, no data collection. Ratings are read directly from csfd.cz and stored only in your browser. Open source (MIT).

Unofficial; not affiliated with ČSFD.
```

## Chrome Web Store – Privacy practices tab

- **Single purpose:** Show ČSFD film ratings next to links to ČSFD on web pages and next to the open title on streaming sites.
- **Permission justification:**
  - Content script on all sites: links to ČSFD can appear on any website. The script reads page text locally to find them. On Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání (Česká televize), Prima+, Voyo (Slovakia), Canal+, Rakuten TV, MUBI, KVIFF.TV and JustWatch it also reads the title, year and type of the detail the user opens.
  - `https://www.csfd.cz/*`: download the public film page to read its rating. This happens for the first 10 distinct films visible on a page; others load after the user hovers or keyboard-focuses the link. On streaming sites, search ČSFD for the title whose detail the user opened (at most 2 searches + the film page).
  - `storage`: rating cache and settings.
  - `activeTab`: the per-site on/off switch and link count in the popup.
- **Remote code:** No.
- **Data usage:** the developer collects no data. Requests to csfd.cz reveal to ČSFD which films are linked on pages the user views, as opening those links would, and which titles' details the user opens on streaming sites. Firefox declares this as `websiteContent` in the manifest. In Chrome's data-usage form, tick **Website content**; consider **Web history** too, since titles of opened streaming details (partly from the tab title) are sent to csfd.cz.
- **Category suggestion:** pick in the dashboard. "Tools" or "Entertainment" fit best.

## Firefox (AMO)

- Developer Hub: https://addons.mozilla.org/developers/addon/%C4%8Dsfd-ratings-everywhere/edit (slug `čsfd-ratings-everywhere`, add-on id `csfd-ratings-everywhere@tohu12.github.io`), developer name "ToHu12". Listed on AMO; Firefox and Firefox for Android.
- Listing: descriptions in cs, sk and en-US (the summary comes from the manifest), category "Photos, Music & Videos", license MIT, support website = GitHub issues (no support e-mail), privacy policy = the text of `docs/PRIVACY.md`, the five en screenshots with the English captions from the Edge section.
- "Do you need to submit source code?": **Yes**, attach `*-sources.zip`. Notes to reviewer (build steps + how to test):

```
Build from source (the code is bundled by WXT/Vite, so the sources zip is attached to this version):
1. Node 22 (see .nvmrc) and pnpm 11 (corepack enable).
2. Unzip the sources and run: pnpm install --frozen-lockfile && pnpm build:firefox
3. Output: .output/firefox-mv2 (identical to the uploaded package). Source repository: https://github.com/tohu12/csfd-ratings-everywhere (tag v1.3.5).

How to test (no account needed):
1. Open any page that links to ČSFD (csfd.cz, the Czech film database), e.g. https://github.com/tohu12/csfd-ratings-everywhere - a small badge with the film's ČSFD rating (e.g. 72 %) appears next to the ČSFD film link; hover it for the title and number of ratings. Plain-text ČSFD film URLs become clickable links.
2. Streaming sites: open a public detail page, e.g. https://www.ceskatelevize.cz/porady/14106473148-wind-river/ or https://kviff.tv/videos/az-na-veky, then click anywhere on the page once (the lookup waits for a user action). The rating appears next to the title.
3. Toolbar popup: switch the extension off for the current site. The options page switches between the badge and a hover-card-only mode.

Network: only https://www.csfd.cz (public film and search pages): at most the first 10 films per page automatically, others on hover; cached. No analytics, no remote code, no data collection beyond what data_collection_permissions declares (websiteContent: film ids / opened titles are sent to csfd.cz). ČSFD may show a bot-protection page to some networks; the extension then shows a neutral "ČSFD" badge linking to the film.
```

- Upload `*-firefox.zip` **and** `*-sources.zip` (the code is bundled, so AMO reviewers need the sources).
- Build instructions for reviewers: `pnpm install && pnpm build:firefox` (Node 22, pnpm 11). Output: `.output/firefox-mv2`.
- Data collection: the manifest declares `required: ["websiteContent"]` (see SPEC §8).

## Edge Add-ons

- Partner Center: https://partner.microsoft.com/dashboard/microsoftedge/a446f9df-188c-4ed6-ad21-7d0f10156243 (Store ID `0RDCKBP72HBJ`, CRX ID `igdncdlikjdcemekhomjlbllhakiiddg`). Publisher display name "ToHu".
- Upload the `*-edge.zip` (same code as Chrome). Reuse the CWS descriptions, the 128 px icon as logo and both promo tiles. Category Entertainment, website + support URLs as above.
- Privacy tab: the same single purpose, permission justifications and "Website content" as the CWS Privacy practices tab; privacy policy URL as above. The three "I certify" disclosures are ticked by the owner.
- Screenshots: cs (also used for sk) and en, with captions in each language (order 1 before, 2 badges, 3 hover card, then streaming and popup in cs/sk, popup and streaming in en):
  - cs: "Bez rozšíření: odkazy na ČSFD jen jako text", "S rozšířením: hodnocení u každého odkazu", "Po najetí myší: název filmu a počet hodnocení", "Hodnocení i na streamovacích službách", "Vypnutí na libovolném webu jedním kliknutím"
  - sk: "Bez rozšírenia: odkazy na ČSFD len ako text", "S rozšírením: hodnotenie pri každom odkaze", "Po prejdení myšou: názov filmu a počet hodnotení", "Hodnotenie aj na streamovacích službách", "Vypnutie na ľubovoľnom webe jedným kliknutím"
  - en: "Without the extension: ČSFD links as plain text", "With the extension: a rating next to every link", "On hover: the film's title and number of ratings", "Turn it off for any site with one click", "Ratings on streaming services too"
- Submission: answer "Yes, I need to provide … other info for testers" (with "No" the notes field is locked) and paste these certification notes; they are required with every submission:

```
No account or login is needed. How to test:
1) Open any page that links to ČSFD (csfd.cz, the Czech film database), e.g. the project README: https://github.com/tohu12/csfd-ratings-everywhere - a small badge with the film's ČSFD rating (e.g. 72 %) appears next to the ČSFD film link. Hover it to see the title and number of ratings. Plain-text ČSFD film URLs on a page become clickable links.
2) Streaming sites: open a public detail page, e.g. https://www.ceskatelevize.cz/porady/14106473148-wind-river/ or https://kviff.tv/videos/az-na-veky, then click anywhere on the page once (the lookup waits for a user action). The ČSFD rating appears next to the title.
3) Toolbar popup: switch the extension off for the current site. The options page switches between the badge and a hover-card-only mode.
Network: the extension contacts only https://www.csfd.cz (public film and search pages) to read ratings: at most the first 10 films per page automatically, others on hover; results are cached. No analytics, no remote code, no data collection. ČSFD may show a bot-protection page to some networks; the extension then shows a neutral "ČSFD" badge linking to the film instead of a rating.
Same package as our Chrome Web Store listing (item kbjdlndiblnokkakiadadgidobnnmpne). Source code: https://github.com/tohu12/csfd-ratings-everywhere
```
