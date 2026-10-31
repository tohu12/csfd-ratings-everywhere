---
paths:
  - "src/entrypoints/background.ts"
  - "src/lib/rating-service.ts"
  - "src/lib/rating-parser.ts"
  - "src/lib/queue.ts"
  - "src/lib/cache.ts"
  - "src/lib/messages.ts"
---
# Background rules

- Be a polite client of csfd.cz:
  - ≤ 2 concurrent requests, ≥ 400 ms spacing,
  - dedupe in-flight ids,
  - cache per SPEC §6,
  - network only as SPEC §4 allows (first 10 films per page automatically, the rest on user action),
  - exponential backoff when blocked.
- **Never circumvent Anubis.** No PoW, no spoofed headers/UA, no hidden tabs/iframes/offscreen documents to pass the challenge. Detect it and return `blocked`.
- MV3 service workers can be killed at any time:
  - no state that must survive lives only in memory (backoff deadline → `storage.session`; cache → `storage.local`),
  - register listeners synchronously at top level.
- Chrome service workers have no `DOMParser`. The parser works on strings (JSON-LD + targeted regexes) and must stay pure.
- Validate every incoming message with the guards in `messages.ts`. Return `undefined` for unknown messages so other listeners still work.
