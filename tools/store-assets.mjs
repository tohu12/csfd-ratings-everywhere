// Renders store screenshots (1280×800) and the small promo tile (440×280) from the real build.
// Usage: pnpm build && node tools/store-assets.mjs
// Uses a fictional demo forum and fictional films: no third-party sites, no real ratings.
// Localized output needs Linux (see the --lang note below); CI workflow: store-assets.yml.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const extensionPath = join(root, '.output', 'chrome-mv3');
const outDir = join(root, 'docs', 'store');
const SITE = 'https://filmove-forum.example';

const FILMS = {
  101: { name: 'Poslední léto u jezera', rating: 86, count: 12480 },
  102: { name: 'Stíny nad městem', rating: 54, count: 3215 },
  103: { name: 'Robotí kuchař 3', rating: 23, count: 978 },
  104: { name: 'Tichý přístav', rating: null, count: 0 },
};

const csfdPage = (id) => {
  const film = FILMS[id];
  const ld = { '@type': 'Movie', name: film.name };
  if (film.rating !== null) {
    ld.aggregateRating = { ratingValue: film.rating, bestRating: 100, ratingCount: film.count };
  }
  return `<html><script type="application/ld+json">${JSON.stringify(ld)}</script><h1>${film.name}</h1></html>`;
};

const post = (author, text) =>
  `<article><header><b>${author}</b><span>před 2 hodinami</span></header><p>${text}</p></article>`;

const forum = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><style>
  body{margin:0;background:#f4f1ea;font:20px/1.6 Georgia,serif;color:#2b2b2b}
  .top{background:#3b3a36;color:#f4f1ea;padding:18px 48px;font:600 22px system-ui}
  main{max-width:1040px;margin:28px auto}
  h1{font:600 30px system-ui;margin:0 0 18px}
  article{background:#fff;border:1px solid #e2ddd2;border-radius:10px;padding:18px 24px;margin-bottom:16px}
  header{display:flex;gap:14px;font:15px system-ui;color:#777;margin-bottom:6px}
  header b{color:#2b2b2b}
  a{color:#1a5fb4}
</style></head><body><div class="top">Filmové fórum (demo)</div><main>
<h1>Co jste viděli tento týden?</h1>
${post('Jana', 'Doporučuju https://www.csfd.cz/film/101-posledni-leto-u-jezera/prehled/ – krásný film na večer.')}
${post('Petr', 'Viděl jsem www.csfd.cz/film/102-stiny-nad-mestem a byl to slušný průměr.')}
${post('Lukáš', 'Tohle jsem nedokoukal: https://www.csfd.cz/film/103-roboti-kuchar-3/')}
${post('Eva', 'Novinka, zatím bez hodnocení: csfd.cz/film/104-tichy-pristav')}
</main></body></html>`;

const tile = (
  icon,
  width,
  height,
  scale,
) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
  body{--s:${scale};display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:calc(14px * var(--s));background:linear-gradient(135deg,#3a5f9a,#17294d);color:#fff;
    font:600 calc(30px * var(--s)) system-ui}
  img{width:calc(84px * var(--s));height:calc(84px * var(--s))}
  .row{display:flex;gap:calc(10px * var(--s));align-items:center}
  .pill{padding:calc(2px * var(--s)) calc(12px * var(--s));border-radius:999px;font:700 calc(16px * var(--s)) system-ui}
</style></head><body>
  <img src="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}">
  <div>ČSFD hodnocení všude</div>
  <div class="row"><span class="pill" style="background:#ba0305">86 %</span>
  <span class="pill" style="background:#4a7ab0">54 %</span>
  <span class="pill" style="background:#535353">23 %</span></div>
</body></html>`;

async function launch(lang) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    locale: lang,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // Sets the UI language (and so chrome.i18n) on Linux. macOS ignores it: run this in CI
      // (.github/workflows/store-assets.yml) to get correctly localized screenshots.
      `--lang=${lang}`,
      '--host-resolver-rules=MAP www.csfd.cz 127.0.0.1:9, MAP filmove-forum.example 127.0.0.1:9',
    ],
  });
  await context.route('https://www.csfd.cz/**', (route) => {
    const id = Number(/\/film\/(\d+)\//.exec(route.request().url())?.[1]);
    return route.fulfill({ contentType: 'text/html', body: csfdPage(id) });
  });
  await context.route(`${SITE}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: forum }),
  );
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return { context, extensionId: new URL(worker.url()).host };
}

await mkdir(outDir, { recursive: true });
for (const lang of ['cs', 'en']) {
  const { context, extensionId } = await launch(lang);
  const page = await context.newPage();

  // 0. Before: the same forum without the extension's work (plain-text URLs).
  const plain = await context.newPage();
  await plain.route(`${SITE}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: forum.replace('<main>', '<main data-before>'),
    }),
  );
  await plain.goto(`${SITE}/before`);
  await plain.evaluate(() => {
    // Undo linkify for the "before" shot: replace our links + badges with their text.
    for (const el of document.querySelectorAll('[data-csfd-linker]')) {
      el.replaceWith(el.getAttribute('data-csfd-linker') === 'link' ? (el.textContent ?? '') : '');
    }
  });
  await plain.screenshot({ path: join(outDir, `screenshot-1-before-${lang}.png`) });
  await plain.close();

  // 1. Badges next to links.
  await page.goto(`${SITE}/`);
  await page.locator('[data-csfd-linker="badge"] >> nth=3 >> a').getByText('– %').waitFor();
  await page.screenshot({ path: join(outDir, `screenshot-2-badges-${lang}.png`) });

  // 2. Hover card (tooltip mode).
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#display').selectOption('tooltip');
  await options.locator('#status').filter({ hasText: /\S/ }).waitFor();
  await page.reload();
  await page.locator('a[data-csfd-linker="link"]').first().hover();
  await page.locator('[data-csfd-linker="card"] .pill').getByText('86 %').waitFor();
  await page.screenshot({ path: join(outDir, `screenshot-3-hover-card-${lang}.png`) });

  // 3. Popup over the forum page.
  await options.locator('#display').selectOption('badge');
  await options.locator('#status').filter({ hasText: /\S/ }).waitFor();
  await page.reload();
  await page.locator('[data-csfd-linker="badge"] >> nth=0 >> a').getByText('86 %').waitFor();
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 300, height: 260 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  // Opened as a tab, the popup cannot see the forum tab; show the state it has over that page.
  await popup.locator('#global-toggle:checked').waitFor();
  await popup.evaluate(() => {
    const site = document.getElementById('site-toggle');
    if (site instanceof HTMLInputElement) {
      site.disabled = false;
      site.checked = true;
    }
    const name = document.getElementById('site-name');
    if (name) {
      name.textContent = 'filmove-forum.example';
    }
    const count = document.getElementById('link-count');
    if (count) {
      count.textContent = '4';
    }
  });
  const popupShot = await popup.screenshot();
  await popup.close();
  await page.evaluate((png) => {
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${png}`;
    img.style.cssText =
      'position:fixed;top:12px;right:24px;width:300px;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);z-index:2147483647';
    document.body.append(img);
  }, popupShot.toString('base64'));
  await page.screenshot({ path: join(outDir, `screenshot-4-popup-${lang}.png`) });

  // 5. Settings page (back to the default badge mode).
  await options.locator('#display').selectOption('badge');
  await options.locator('#status').filter({ hasText: /\S/ }).waitFor();
  await options.evaluate(() => {
    document.body.style.zoom = '1.5';
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '';
    }
  });
  await options.screenshot({ path: join(outDir, `screenshot-5-settings-${lang}.png`) });
  await context.close();
}

const icon = await readFile(join(root, 'src', 'assets', 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const [name, width, height, scale] of [
  ['promo-small-440x280.png', 440, 280, 1],
  ['promo-marquee-1400x560.png', 1400, 560, 2],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(tile(icon, width, height, scale));
  await page.screenshot({ path: join(outDir, name) });
  await page.close();
}
await browser.close();
console.log(`Store assets written to ${outDir}`);
