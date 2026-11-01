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
| Screenshots 1280×800, max 5, order 1→5 (5 = streaming sites: a fictional page, service names as text only, no logos) | `docs/store/screenshot-{1..5}-*-{cs,en}.png` | CWS (per locale), Edge, AMO |
| Small promo tile 440×280 | `docs/store/promo-small-440x280.png` | CWS (required), Edge |
| Marquee 1400×560 | `docs/store/promo-marquee-1400x560.png` | CWS (used only if featured) |

## Czech (primary listing)

**Name (≤ 75):** ČSFD hodnocení všude

**Summary (≤ 132):** Z odkazů na ČSFD na jakémkoli webu udělá klikatelné odkazy a ukáže u nich hodnocení filmu v procentech. Neoficiální.

**Description:**
```
Na fórech, v diskuzích a na blozích bývají odkazy na ČSFD často jen jako text a hodnocení filmu tak nevidíte. Toto rozšíření je doplní za vás, na jakémkoli webu.

• Textové odkazy na ČSFD udělá klikatelné, včetně seriálů a epizod.
• U odkazu ukáže hodnocení filmu v % v barvách ČSFD a po najetí myší i název a počet hodnocení.
• Prvních 10 filmů na stránce se načte hned, ostatní po najetí myší.
• Zobrazení si vyberete: malý odznak u odkazu, nebo jen plovoucí karta (nic se nevkládá do stránky).
• Na streamovacích službách ukáže hodnocení u otevřeného detailu filmu nebo seriálu: Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, Voyo, Canal+, Rakuten TV, MUBI, KVIFF.TV a JustWatch. Když si není jistý, ukáže „ČSFD ?“ s odkazem na hledání.
• Na libovolném webu jde vypnout jedním kliknutím.
• Česky, slovensky a anglicky.

Šetrné k ČSFD i k vašemu prohlížeči: každý film se stáhne jen jednou, hodnocení se ukládají do mezipaměti, počet požadavků je omezený a rozšíření je malé a rychlé.

Soukromí: žádná analytika ani sběr dat. Hodnocení se čte přímo z csfd.cz a ukládá jen ve vašem prohlížeči. Zdrojový kód je otevřený (MIT).

Neoficiální rozšíření, není spojeno s ČSFD.
```

## Slovak

**Name:** ČSFD hodnotenie všade

**Summary:** Z odkazov na ČSFD na akomkoľvek webe urobí klikateľné odkazy a ukáže pri nich hodnotenie filmu v percentách. Neoficiálne.

**Description:**
```
Na fórach, v diskusiách a na blogoch bývajú odkazy na ČSFD často len ako text a hodnotenie filmu tak nevidíte. Toto rozšírenie ich doplní za vás, na akomkoľvek webe.

• Textové odkazy na ČSFD urobí klikateľné, vrátane seriálov a epizód.
• Pri odkaze ukáže hodnotenie filmu v % vo farbách ČSFD a po prejdení myšou aj názov a počet hodnotení.
• Prvých 10 filmov na stránke sa načíta hneď, ostatné po prejdení myšou.
• Zobrazenie si vyberiete: malý odznak pri odkaze, alebo len plávajúca karta (nič sa nevkladá do stránky).
• Na streamovacích službách ukáže hodnotenie pri otvorenom detaile filmu alebo seriálu: Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, Voyo, Canal+, Rakuten TV, MUBI, KVIFF.TV a JustWatch. Keď si nie je istý, ukáže „ČSFD ?“ s odkazom na vyhľadávanie.
• Na ľubovoľnom webe sa dá vypnúť jedným kliknutím.

Šetrné k ČSFD aj k vášmu prehliadaču: každý film sa stiahne len raz, hodnotenia sa ukladajú do vyrovnávacej pamäte a počet požiadaviek je obmedzený.

Súkromie: žiadna analytika ani zber dát. Otvorený zdrojový kód (MIT). Neoficiálne rozšírenie, nie je spojené s ČSFD.
```

## English

**Name:** ČSFD Ratings Everywhere

**Summary:** Turns links to ČSFD (the Czech-Slovak film database) on any website into clickable links showing the film's rating. Unofficial.

**Description:**
```
Forums and blogs often mention ČSFD films as plain-text URLs, so you can't see how good the film is. This extension fills that in, on any website.

• Turns plain-text ČSFD URLs into clickable links, including series and episodes.
• Shows the film's ČSFD rating in % in ČSFD's colours, with the title and number of ratings on hover.
• The first 10 films on a page load right away; others when you hover.
• Choose how it looks: a small badge next to the link, or a hover card only (nothing is inserted into the page).
• On streaming sites it shows the rating of the open film or series: Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, Voyo, Canal+, Rakuten TV, MUBI, KVIFF.TV and JustWatch. When unsure, it shows "ČSFD ?" linking to the search.
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

- Upload `*-firefox.zip` **and** `*-sources.zip` (the code is bundled, so AMO reviewers need the sources).
- Build instructions for reviewers: `pnpm install && pnpm build:firefox` (Node 22, pnpm 11). Output: `.output/firefox-mv2`.
- Data collection: the manifest declares `required: ["websiteContent"]` (see SPEC §8).

## Edge Add-ons

- Upload the `*-edge.zip` (same code as Chrome). Reuse the CWS texts and graphics.
