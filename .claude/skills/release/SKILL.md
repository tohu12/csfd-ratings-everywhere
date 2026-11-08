---
name: release
description: Cut a release - bump version, update CHANGELOG, tag, build store zips for Chrome, Edge and Firefox, then submit the update to the three stores. Only when the user explicitly asks to release.
disable-model-invocation: true
argument-hint: <patch|minor|major>
---

# Release

Bump: $ARGUMENTS

## 1. Cut the release
1. Make sure the working tree is clean and on `main`, and that `pnpm check`, `pnpm test:e2e` and `pnpm size` pass.
2. `pnpm version $ARGUMENTS --no-git-tag-version`.
3. Move the `## Unreleased` notes in CHANGELOG.md under the new version with today's date.
4. Commit `chore(release): vX.Y.Z` and create an **annotated** tag: `git tag -a vX.Y.Z -m vX.Y.Z` (`--follow-tags` skips lightweight tags). **Ask the user before** `git push --follow-tags`.
5. `gh run watch` the Release workflow, then `gh release download vX.Y.Z -p '*-chrome.zip' -p '*-edge.zip' -p '*-firefox.zip' -p '*-sources.zip' -D <scratchpad>` and check `version` in each zip's `manifest.json`.

## 2. Submit to the stores (only when the owner asks; texts in `docs/store-listing.md`)
Use `agent-browser --headed` with a persistent `--session-name` and ask the owner to sign in when a login page shows. Dashboard URLs: `docs/store-listing.md` and the owner's `CLAUDE.local.md`. Legal attestations (certify checkboxes, agreements) are the owner's: ask, never tick them yourself.

A version update needs only the package; texts and images stay unless they changed.
- **Chrome Web Store:** Package → "Upload new package" → set the file on `input[type=file]` → check the draft shows the new version and unchanged permissions → "Submit for review" → confirm the dialog (auto-publish on) and the "publishing may be delayed" broad-host-permission warning. Done when the item list says "Pending review".
- **Edge Partner Center:** Packages → upload `*-edge.zip` → wait for "verified" → Continue through the steps → Publish. On the submission page answer **"Yes, I need to provide … info for testers"** (with "No" the notes field is locked) and paste the certification notes from `docs/store-listing.md`; they are required with every submission. Done when the overview says "In review".
- **AMO:** Mozilla asks for a fresh sign-in first. "Upload New Version" → `*-firefox.zip` → validation must pass → "Do you need to submit source code?" **Yes** + `*-sources.zip` → notes to reviewer from `docs/store-listing.md`. Done when Versions says "Awaiting Review".

After submitting, record the state in `docs/STATUS.md` (Stores row) and push.

## Store metadata rules
- Never list all streaming services in descriptions, screenshots or tiles (Chrome rejected v1.3.1 as keyword spam, "Yellow Argon"). At most Netflix, Disney+, HBO Max, once.
- The short summary is `extDescription` in `public/_locales/*/messages.json`; changing it needs a new package. "Unofficial" stays only at the end of the long description (owner, 2026-11-08).
- New permissions or features: update the listing texts, the privacy forms in all three stores and `docs/PRIVACY.md` in the same change.

## Dashboard quirks (agent-browser)
- Uploads: target the real `input[type=file]` (tag it with an id via `eval`, then `upload '#id'`). In Edge and Chrome the input index shifts after each upload, so pick it by section text. Upload screenshots one at a time and wait until the count grows, or they get dropped.
- Refs go stale after every re-render: re-snapshot before each click. A stale ref can hit the header (Edge: Settings or Action Center) instead of "Save draft".
- Chrome: removing an image opens a confirm dialog; confirm only the dialog you opened. The same 5 screenshots exist per locale **and** as global assets.
- Edge: "Duplicate … for all languages" does not carry over, so fill each language (cs, sk, en) separately. Captions attach in DOM order, so set them by file name ("Edit screenshot <file>").
- AMO: the section "Edit" links are `#` anchors with `data-editurl`; trigger them with a dispatched click event. Extra locales (cs, sk) are form fields `description_<locale>` in the describe form.
