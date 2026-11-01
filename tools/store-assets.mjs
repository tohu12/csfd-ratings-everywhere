// Renders store screenshots (1280×800) and the small promo tile (440×280) from the real build.
// Usage: pnpm build && node tools/store-assets.mjs
// Uses a fictional demo forum, a fictional streaming page and fictional films: no third-party
// branding, no real ratings.
// Localized output needs Linux (see the --lang note below); CI workflow: store-assets.yml.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const extensionPath = join(root, '.output', 'chrome-mv3');
const outDir = join(root, 'docs', 'store');
const SITE = 'https://filmove-forum.example';
// A curated VOD host (SPEC §4b), so the VOD script runs; the page itself is fictional and the
// screenshot shows no URL.
const VOD = 'https://kviff.tv/videos/posledni-leto-u-jezera';

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

const csfdSearch = `<html><article><a href="/film/101-posledni-leto-u-jezera/" class="film-title-name">${FILMS[101].name}</a>
<span class="film-title-info"><span class="info">(2024)</span></span></article></html>`;

// Service names as plain text only: no logos or artwork of the services.
const STREAMING_CAPTION = {
  cs: 'Hodnocení ČSFD i na streamovacích službách',
  en: 'ČSFD ratings on streaming services too',
};
// Keep in sync with VOD_SITES (src/lib/vod/detect.ts).
const STREAMING_SERVICES =
  'Netflix · Disney+ · HBO Max · Apple TV · Prime Video · SkyShowtime · Oneplay · iVysílání ČT · Prima+ · Voyo · Canal+ · Rakuten TV · MUBI · KVIFF.TV · JustWatch';

const streaming = (caption) => `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<title>${FILMS[101].name} | Demo kino</title><style>
  body{margin:0;background:#101114;color:#eee;font:18px/1.5 system-ui}
  .caption{background:linear-gradient(135deg,#ba0305,#7d0204);color:#fff;text-align:center;
    padding:16px 32px;font:700 30px system-ui}
  .caption small{display:block;font:500 19px/1.45 system-ui;margin-top:6px}
  .top{padding:18px 48px;font:700 20px system-ui;letter-spacing:.04em;color:#fff}
  .hero{margin:0 48px;height:150px;border-radius:14px;
    background:linear-gradient(120deg,#e9a35b 0%,#b5546a 45%,#2c3e6b 100%)}
  main{margin:16px 34px;max-width:820px;zoom:1.4}
  h1{font:700 44px system-ui;margin:0 0 10px;display:inline-block}
  .meta{color:#aaa;margin-bottom:18px;font-size:19px}
  p{color:#ccc;margin:0 0 26px}
  .play{display:inline-block;background:#fff;color:#111;font-weight:700;padding:12px 30px;border-radius:8px}
</style></head><body><div class="caption">${caption}<small>${STREAMING_SERVICES}</small></div><div class="top">DEMO KINO</div><div class="hero"></div><main>
<h1>${FILMS[101].name}</h1>
<div class="meta"><span>2024</span> · <span>1 h 52 min</span> · Drama</div>
<p>Poslední prázdniny před odjezdem na studia. Čtyři kamarádi, jedno jezero a léto, na které nezapomenou.</p>
<span class="play">▶ Přehrát</span>
</main></body></html>`;

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
    gap:calc(14px * var(--s));background:linear-gradient(135deg,#ba0305,#7d0204);color:#fff;
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
      '--host-resolver-rules=MAP www.csfd.cz 127.0.0.1:9, MAP filmove-forum.example 127.0.0.1:9, MAP kviff.tv 127.0.0.1:9',
    ],
  });
  await context.route('https://www.csfd.cz/**', (route) => {
    if (route.request().url().includes('/hledat/')) {
      return route.fulfill({ contentType: 'text/html', body: csfdSearch });
    }
    const id = Number(/\/film\/(\d+)\//.exec(route.request().url())?.[1]);
    return route.fulfill({ contentType: 'text/html', body: csfdPage(id) });
  });
  await context.route(`${SITE}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: forum }),
  );
  await context.route('https://kviff.tv/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: streaming(STREAMING_CAPTION[lang]) }),
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

  // 5. Streaming site: the rating next to the open title (SPEC §4b).
  await page.goto(VOD);
  // The lookup waits for the user's first interaction with the page.
  await page.mouse.click(640, 700);
  await page.locator('[data-csfd-linker="badge"] a').getByText('86 %').waitFor();
  await page.screenshot({ path: join(outDir, `screenshot-5-streaming-${lang}.png`) });
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
