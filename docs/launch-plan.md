# Launch plan

Internal working document (not published on the website). Sources: Chrome Web Store docs ["Creating a great listing page"](https://developer.chrome.com/docs/webstore/best-listing) and ["Discovery"](https://developer.chrome.com/docs/webstore/discovery); Firefox [Recommended Extensions](https://extensionworkshop.com/documentation/publish/recommended-extensions/).

## What drives ranking (official)

- **Chrome Web Store:**
  - user ratings and usage statistics (installs vs. uninstalls over time),
  - design, clarity of purpose, **onboarding** and ease of use,
  - search uses listing metadata, so a complete, accurate listing helps; keyword stuffing gets items suspended.
- **Featured badge (CWS):** self-nomination through One Stop Support. Needs:
  - no policy violations,
  - core features without login or payment,
  - English support.
  - All of these are met. Nominate after the listing has a few weeks of good ratings.
- **Established Publisher badge:** automatic after identity verification plus a few months of a clean track record.
- **Firefox Recommended:** curated, needs broad international relevance. Unlikely for a ČSFD-specific extension; don't count on it.

## Checklist

### Before submitting
- [x] Listing texts cs/sk/en, summary ≤ 132 (enforced by a test): `docs/store-listing.md`
- [x] Graphics: icon 128 (96 + 16 px padding), 5 screenshots 1280×800, promo 440×280, marquee 1400×560
- [x] Website, support, privacy URLs (GitHub Pages)
- [x] Honest privacy disclosure (Firefox `websiteContent`)
- [x] Run **Store assets** workflow (2026-11-01, red UI) → use the localized `-cs` screenshots for the Czech listing
- [x] Onboarding page on install (v1.1.0)
- [ ] Optional but recommended: write to ČSFD (draft below, mentions the VOD search since 2026-11-01)

### Submission day
- [ ] CWS: developer account (one-time fee), verified contact e-mail, publisher name; upload `*-chrome.zip`, fill listing + Privacy practices
- [ ] Edge Partner Center: upload `*-edge.zip`, reuse texts/graphics
- [ ] AMO: upload `*-firefox.zip` + `*-sources.zip`
- [ ] Expect a longer CWS review because of the `<all_urls>` content script

### After approval
- [ ] Replace "již brzy" links on the website and in README with store links
- [ ] Announce (see Channels)
- [ ] Answer every review and issue within a few days (a ranking signal: users see responsiveness)
- [ ] After ~4 weeks with good ratings: nominate for the CWS Featured badge

## Channels (where ČSFD links live)

Post only where self-promotion is allowed, read each community's rules first, and lead with the problem it solves plus a screenshot:
1. **warcenter.cz** and similar Czech/Slovak film and download forums: a thread in their software/off-topic section. This is exactly where plain-text ČSFD links are everywhere.
2. **Reddit:** r/czech, r/Slovakia, r/cesky (check the rules on self-promo).
3. **Facebook film groups** (CZ/SK). Ask the admins first.
4. **Czech tech media** (e.g. Živě.cz, Lupa.cz, Jablíčkář): a short tip e-mail with screenshots and the open-source angle.
5. **ČSFD itself:** only after their consent (below). A mention by ČSFD would be the single biggest boost.

## Product improvements for growth

- **Onboarding page on install:** done in v1.1.0.
- **Rating link in the popup** (e.g. "Líbí se vám? Ohodnoťte rozšíření"): add after the listings are live, since it needs the per-store URLs. Keep it static: no nagging, no incentives.
- ~~Uninstall feedback URL~~: rejected by the owner (not useful enough).

## Draft e-mail to ČSFD

> **Předmět:** Neoficiální rozšíření prohlížeče, které zobrazuje hodnocení ČSFD u odkazů
>
> Dobrý den,
>
> vytvořil jsem open-source rozšíření pro Chrome, Edge a Firefox „ČSFD hodnocení všude“. Na webech, kde jsou odkazy na ČSFD jen jako text (fóra, diskuze), z nich udělá odkazy a ukáže u nich hodnocení filmu. Uživatelé se tak dostanou na ČSFD jedním klikem.
>
> Na vybraných streamovacích službách (Netflix, Disney+, HBO Max, iVysílání ČT a další) navíc ukáže hodnocení u filmu nebo seriálu, jehož detail si uživatel otevře. Název dohledá přes vyhledávání ČSFD: nejvýš 2 hledání a jedna stránka filmu, až když uživatel se stránkou pracuje, nikdy u náhledů v nabídce. Když si shodou není jistý, ukáže jen odkaz na vyhledávání na ČSFD.
>
> Chci, aby rozšíření bylo k ČSFD šetrné:
> - každý film se stáhne nejvýš jednou za týden (cache),
> - automaticky max. 10 filmů na stránku, ostatní až po najetí myší,
> - nejvýš 2 souběžné požadavky,
> - při jakémkoli signálu zpomalení (bot ochrana, HTTP 429/503) se rozšíření samo na dlouho odmlčí,
> - ochranu webu nijak neobchází.
>
> Rád bych se zeptal, zda s takovým použitím souhlasíte, případně zda nabízíte oficiální API nebo preferujete jiný způsob. Kód je veřejný: https://github.com/tohu12/csfd-ratings-everywhere
>
> Děkuji a zdravím,
> Tomáš Hulek
