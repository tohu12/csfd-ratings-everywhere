---
name: add-url-pattern
description: Add support for a new ČSFD URL shape (new host, path prefix, nesting) end-to-end with tests. Use when a ČSFD link on some page is not detected or is parsed to the wrong id.
argument-hint: <example ČSFD URL that is not recognised>
---

# Add a ČSFD URL pattern

Example URL: $ARGUMENTS

1. Reproduce: add the URL to the `it.each` table in `tests/unit/csfd-url.test.ts`, with the expected `{ id, href }`. Include it embedded in surrounding text with trailing punctuation. Run `pnpm test csfd-url` and confirm it fails.
2. Add at least one **negative** case nearby (a similar-looking URL that must NOT match) so the regex does not over-match.
3. Update `src/lib/csfd-url.ts`. Keep the regex linear-time: no nested quantifiers over overlapping character classes.
4. Update SPEC.md §2 with the new shape.
5. Run `pnpm check` and `pnpm bench` (the regex runs on every text node containing "csfd.").
6. Delegate to the `code-reviewer` subagent, then commit as `feat(url): support <shape>`.
