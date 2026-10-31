# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## Unreleased

### Added
- Detects ČSFD film URLs in plain text and existing links on any website (series/episode URLs included).
- Turns plain-text URLs into links.
- Rating display: inline badge (default) or hover card ("tooltip" mode).
- Ratings are fetched only after a real hover or keyboard focus; cached ratings show immediately.
- Background fetching with cache, rate limiting, a bounded queue, and backoff when ČSFD asks to slow down (bot protection, 429/503 + Retry-After).
- Popup (per-site and global switch, link count) and options page.
- Czech, Slovak and English UI.
