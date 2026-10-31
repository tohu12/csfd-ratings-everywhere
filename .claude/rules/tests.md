---
paths:
  - "tests/**"
---
# Test rules

- Coverage of `src/` is enforced at 100 % (lines, branches, functions, statements). A new branch without a test fails CI and the Stop hook.
- Tests must be deterministic:
  - no real network, no real timers (`vi.useFakeTimers()` or injected clocks/schedulers),
  - no dependence on test order.
- Browser APIs: `fakeBrowser` from `wxt/testing/fake-browser`. Call `fakeBrowser.reset()` in `beforeEach`.
- ČSFD HTML only from `tests/fixtures/csfd/`. Never fetch live csfd.cz.
- Test behaviour through the public API of a module, not private helpers.
- One `describe` per exported unit; test names read as specs (`it('returns blocked for an Anubis page')`).
- No `.only` or `.skip` in commits.
