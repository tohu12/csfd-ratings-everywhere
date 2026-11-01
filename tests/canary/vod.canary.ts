// Nightly canary (.github/workflows/vod-canary.yml): runs the real detector on live, public VOD
// detail pages, so a redesign is noticed before users report it. Not part of `pnpm check`: it is
// the only test that touches the network, and it never contacts ČSFD.
import { appendFile, mkdir } from 'node:fs/promises';
import { test } from '@playwright/test';
import { Window } from 'happy-dom';
import { detectTitle, findSite, normalizeTitle } from '../../src/lib/vod/detect';
import { CANARY_PAGES } from './sites';

/** `gone`: the title left the catalogue (swap the URL); `broken`: detection no longer works. */
type Status = 'ok' | 'gone' | 'broken' | 'unavailable';

interface Result {
  fixture: string;
  url: string;
  status: Status;
  detail: string;
}

// One JSON line per attempt (a failed test restarts the worker, so nothing is kept in memory);
// tools/canary-report.mjs keeps the last line per fixture.
const RESULTS_FILE = 'test-results/canary.jsonl';

for (const page of CANARY_PAGES) {
  test(page.fixture, async ({ page: tab }, info) => {
    const report = async (status: Status, detail: string) => {
      const result: Result = { fixture: page.fixture, url: page.url, status, detail };
      info.annotations.push({ type: status, description: detail });
      await mkdir('test-results', { recursive: true });
      await appendFile(RESULTS_FILE, `${JSON.stringify(result)}\n`);
    };
    const site = findSite(new URL(page.url).hostname);
    if (!site) {
      throw new Error(`${page.url} is not a supported VOD host`);
    }
    const response = await tab
      .goto(page.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch(() => null);
    const status = response?.status() ?? 0;
    // Outages, geo-blocking of CI runners and bot walls say nothing about our detector.
    if (status === 0 || status === 403 || status === 429 || status >= 500) {
      await report('unavailable', `HTTP ${status || 'no response'}`);
      return; // listed in the summary, never an alarm
    }
    await tab.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await tab.waitForTimeout(3_000);
    const finalUrl = new URL(tab.url());
    if (status === 404 || status === 410 || !(site.detailPath?.test(finalUrl.pathname) ?? true)) {
      await report('gone', `HTTP ${status}, now at ${finalUrl.href}`);
      throw new Error(`${page.fixture}: the title is gone (${finalUrl.href}); swap the URL`);
    }
    const found = detect(await tab.content(), finalUrl);
    const expected = new Set(page.titles.map(normalizeTitle));
    const sameTitle = found?.titles.some((t) => expected.has(normalizeTitle(t)));
    if (!found || !sameTitle || found.kind !== page.kind) {
      const seen = found ? `${JSON.stringify(found.titles)} ${found.kind}` : 'nothing';
      await report(
        'broken',
        `expected "${page.titles.join('" or "')}" ${page.kind}, detected ${seen}`,
      );
      throw new Error(`${page.fixture}: detection broke, detected ${seen}`);
    }
    await report('ok', `${found.titles[0]} ${found.year ?? '–'} ${found.kind}`);

    function detect(html: string, url: URL) {
      const window = new Window({
        url: url.href,
        settings: {
          disableJavaScriptEvaluation: true,
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
        },
      });
      // The detector checks `instanceof HTMLImageElement` and walks with NodeFilter.
      Object.assign(globalThis, {
        HTMLImageElement: window.HTMLImageElement,
        Node: window.Node,
        NodeFilter: window.NodeFilter,
      });
      window.document.write(html);
      return site && detectTitle(window.document as unknown as Document, url, site);
    }
  });
}
