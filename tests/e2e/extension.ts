import { join } from 'node:path';
import { type BrowserContext, test as base, chromium, type Route } from '@playwright/test';
import { fixture } from '../helpers/fixtures';

const extensionPath = join(import.meta.dirname, '..', '..', '.output', 'chrome-mv3');

/** Host used for test pages; served from tests/fixtures/pages. */
export const SITE = 'https://warcenter.test';
/** Mocked Netflix: `?fixture=<name>` serves tests/fixtures/pages/vod/<name>.html, else an empty page. */
export const NETFLIX = 'https://www.netflix.com';

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  /** Every request the extension made to csfd.cz (all answered by mocks). */
  csfdRequests: string[];
  /** Body served for ČSFD film pages; tests may override per id. */
  csfdPages: Map<number, { status: number; body: string }>;
}

// Playwright requires object destructuring for fixture args, even when empty (Biome override).
export const test = base.extend<ExtensionFixtures>({
  csfdPages: async ({}, use) => {
    await use(new Map());
  },
  csfdRequests: async ({}, use) => {
    await use([]);
  },
  context: async ({ csfdPages, csfdRequests }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // Safety net: even an unmocked request can never reach the real csfd.cz.
        '--host-resolver-rules=MAP www.csfd.cz 127.0.0.1:9, MAP warcenter.test 127.0.0.1:9, MAP www.netflix.com 127.0.0.1:9',
      ],
    });
    await context.route('https://www.csfd.cz/**', (route: Route) => {
      const url = route.request().url();
      csfdRequests.push(url);
      if (url.includes('/hledat/')) {
        return route.fulfill({ contentType: 'text/html', body: fixture('csfd/search.html') });
      }
      const id = Number(/\/film\/(\d+)\//.exec(url)?.[1]);
      const page = csfdPages.get(id) ?? { status: 200, body: fixture('csfd/film.html') };
      return route.fulfill({ status: page.status, contentType: 'text/html', body: page.body });
    });
    await context.route(`${SITE}/**`, (route: Route) => {
      const name = new URL(route.request().url()).pathname.slice(1) || 'warcenter-like.html';
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"></head><body>${fixture(`pages/${name}`)}</body></html>`,
      });
    });
    await context.route(`${NETFLIX}/**`, (route: Route) => {
      const name = new URL(route.request().url()).searchParams.get('fixture');
      return route.fulfill({
        contentType: 'text/html',
        body: name
          ? fixture(`pages/vod/${name}.html`)
          : '<!doctype html><html><head><meta charset="utf-8"><title>Netflix</title></head><body><main></main></body></html>',
      });
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
