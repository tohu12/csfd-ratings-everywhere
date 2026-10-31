@AGENTS.md

## Claude Code specifics

The harness lives in `.claude/` and is committed:
- **Hooks** (`.claude/settings.json`):
  - `format.sh` runs Biome on every file you edit,
  - `protect.sh` blocks edits to lockfiles, `.env*` and `.git/`,
  - `check.sh` runs on Stop: typecheck + unit tests with coverage must pass before you can finish.
- **Path rules** (`.claude/rules/`) load automatically when you touch content-script, background or test files.
- **Subagents** (`.claude/agents/`), all read-only reviewers:
  - `code-reviewer`: correctness against SPEC.md,
  - `perf-reviewer`: DOM, observers, bundle, request volume,
  - `security-reviewer`: XSS, messaging, permissions, store policy,
  - `test-writer`: writes tests, the only one that edits; edits tests only.
- **Skills** (`.claude/skills/`):
  - `/add-url-pattern`: support a new ČSFD URL shape,
  - `/verify-in-browser`: build + E2E + manual checklist,
  - `/release`: version bump → tag → store zips.

## Workflow for every task

1. Explore, then plan (plan mode for anything touching more than one module).
2. Write or extend the failing test first.
3. Implement until `pnpm check` is green. The Stop hook enforces it.
4. Run `code-reviewer` and `perf-reviewer` on the diff (`security-reviewer` too when DOM insertion, messaging, permissions or the manifest change). Fix confirmed findings.
5. Small commit with a Conventional Commit message. Never push or publish without the user asking.
