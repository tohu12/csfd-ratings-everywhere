import { defineConfig } from '@playwright/test';

// The nightly VOD canary (tests/canary/vod.canary.ts). Live sites, so it is kept apart from the
// E2E suite in playwright.config.ts and from `pnpm check`.
export default defineConfig({
  testDir: 'tests/canary',
  testMatch: '*.canary.ts',
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 90_000,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: { locale: 'cs-CZ', viewport: { width: 1440, height: 900 } },
});
