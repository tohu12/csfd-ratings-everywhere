---
name: release
description: Cut a release - bump version, update CHANGELOG, tag, build store zips for Chrome, Edge and Firefox. Only when the user explicitly asks to release.
disable-model-invocation: true
argument-hint: <patch|minor|major>
---

# Release

Bump: $ARGUMENTS

1. Make sure the working tree is clean and on `main`, and that `pnpm check`, `pnpm test:e2e` and `pnpm size` pass.
2. `pnpm version $ARGUMENTS --no-git-tag-version`.
3. Move the `## Unreleased` notes in CHANGELOG.md under the new version with today's date.
4. Commit `chore(release): vX.Y.Z` and tag `vX.Y.Z`. **Ask the user before** `git push --follow-tags`.
5. The `release.yml` workflow builds the zips and drafts the GitHub Release. Store submission happens only through that workflow (secrets), never locally.
6. Remind the user to check the store listing texts in `docs/store-listing.md` if permissions or features changed.
