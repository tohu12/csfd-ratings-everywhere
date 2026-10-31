# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## Unreleased

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
