# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## Unreleased

## 1.3.1 – 2026-11-01

### Changed
- The extension description names the streaming services (Netflix, Disney+, HBO Max and others).

## 1.3.0 – 2026-11-01

### Added
- When ČSFD pages repeatedly can't be read (ČSFD has probably changed its website), the toolbar icon shows "!" and the popup offers a "Report it" link to a prefilled GitHub issue. Nothing is sent automatically.

## 1.2.0 – 2026-11-01

### Added
- Ratings on streaming sites: open a film's or series' detail on Netflix, Disney+, HBO Max, Apple TV, Prime Video, SkyShowtime, Oneplay, iVysílání ČT, Prima+, Voyo (SK), Canal+, Rakuten TV, MUBI, KVIFF.TV or JustWatch and its ČSFD rating appears next to the title (found via ČSFD search; "ČSFD ?" when the match is not certain).
- Welcome page mentions the streaming sites.

### Changed
- Icon and popup/settings accent use ČSFD red (`#ba0305`) instead of blue; the "%" icon shape stays.

## 1.1.0 – 2026-10-31

### Added
- Welcome page on first install: how it works and what the colours mean.

### Changed
- Popup and settings use the extension's blue instead of ČSFD red, so it does not look like an official ČSFD product.

## 1.0.0 – 2026-10-31

### Added
- Detects ČSFD film URLs in plain text and existing links on any website (series/episode URLs included).
- Turns plain-text URLs into links.
- Rating display: inline badge (default) or hover card ("tooltip" mode).
- Ratings show right away: cached ones instantly, the first 10 distinct films per page automatically, others after a real hover or keyboard focus.
- Background fetching with cache, rate limiting, a bounded queue, and backoff when ČSFD asks to slow down (bot protection, 429/503 + Retry-After).
- Popup (per-site and global switch, link count) and options page.
- Czech, Slovak and English UI.
