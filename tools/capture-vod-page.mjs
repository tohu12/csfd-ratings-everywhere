// Captures a public VOD detail page as a trimmed test fixture (tests/fixtures/pages/vod/README.md).
// Usage: node tools/capture-vod-page.mjs <name> <url> [--headed] [--keep=header,dialog] [--drop=<css>]
//   --headed  real browser window; some sites (MUBI, JustWatch, Canal+) refuse headless Chromium
//   --keep    sections that are normally removed but hold the title on this site
//   --drop    extra selector to remove, e.g. "more titles" strips whose headings compete with the title
// Always a fresh, logged-out profile: never use it for pages behind a login.
// Never for ČSFD (AGENTS.md: no automated traffic to csfd.cz): the owner saves those pages by hand.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [name, url, ...flags] = process.argv.slice(2);
if (!name || !url || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    'Usage: node tools/capture-vod-page.mjs <name> <url> [--headed] [--keep=…] [--drop=…]',
  );
  process.exit(1);
}
const isCsfd = (href) => /(^|\.)csfd\.(cz|sk)$/i.test(new URL(href).hostname);
if (new URL(url).protocol !== 'https:' || isCsfd(url)) {
  console.error('Only https VOD pages. ČSFD pages are saved by the owner by hand (AGENTS.md).');
  process.exit(1);
}
const flag = (key) => flags.find((f) => f.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const options = {
  keep: flag('keep').split(',').filter(Boolean),
  drop: flag('drop'),
};

const browser = await chromium.launch({ headless: !flags.includes('--headed') });
const context = await browser.newContext({
  locale: 'cs-CZ',
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
if (isCsfd(page.url())) {
  await browser.close();
  console.error(`Redirected to ČSFD (${page.url()}): not capturing.`);
  process.exit(1);
}
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(3_000);

const result = await page.evaluate(({ keep, drop }) => {
  const KEEP_ATTRS =
    /^(id|class|alt|href|data-testid|data-uia|data-automation-id|property|content|type|aria-hidden|dir|role|lang|itemprop|datetime|charset)$/;
  const doc = document.documentElement.cloneNode(true);
  const removeAll = (selector, keepIf = () => false) => {
    for (const el of doc.querySelectorAll(selector)) {
      if (!keepIf(el)) {
        el.remove();
      }
    }
  };
  const removeNoise = () => {
    removeAll(
      'script:not([type="application/ld+json"]),style,link,noscript,iframe,video,audio,source,template,canvas',
    );
    const sections = ['header', 'footer', 'nav', '[role="dialog"]'].filter(
      (selector) => !keep.some((kept) => selector.includes(kept)),
    );
    removeAll(sections.join(','));
    // Some sites put a `cookie` class on the page wrapper: only drop banners without a heading.
    removeAll('[id*=cookie i], [class*=cookie i]', (el) => el.querySelector('h1, h2'));
    if (drop) {
      removeAll(drop);
    }
    removeAll(
      'head meta',
      (m) => /^og:/.test(m.getAttribute('property') ?? '') || m.hasAttribute('charset'),
    );
  };
  const stripAttributes = () => {
    for (const el of doc.querySelectorAll('*')) {
      const drop = [...el.attributes].filter(
        (a) => !KEEP_ATTRS.test(a.name) || (a.name === 'class' && a.value.length > 80),
      );
      for (const attr of drop) {
        el.removeAttribute(attr.name);
      }
    }
    // Query strings of links carry per-visit tracking ids (JustWatch clickouts); the detector
    // only reads link paths.
    for (const link of doc.querySelectorAll('[href]')) {
      link.setAttribute('href', link.getAttribute('href').split(/[?#]/)[0]);
    }
    for (const svg of doc.querySelectorAll('svg')) {
      svg.replaceChildren();
    }
  };
  const stripComments = () => {
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) {
      comments.push(walker.currentNode);
    }
    for (const comment of comments) {
      comment.remove();
    }
  };
  removeNoise();
  stripAttributes();
  stripComments();
  return {
    url: location.href,
    title: document.title,
    h1: [...doc.querySelectorAll('h1')].map((h) => h.textContent.trim()),
    html: doc.outerHTML.replace(/\n\s*\n+/g, '\n'),
  };
}, options);
await browser.close();

const date = new Date().toISOString().slice(0, 10);
const kept = options.keep.length ? ` (${options.keep.join(', ')} kept)` : '';
const header = `<!-- ${result.url} captured ${date} logged out; scripts (except JSON-LD), styles, media, header/footer/nav${kept} and most attributes stripped. -->`;
const file = join(import.meta.dirname, '..', 'tests', 'fixtures', 'pages', 'vod', `${name}.html`);
await writeFile(file, `<!doctype html>\n${header}\n${result.html}\n`);
console.log(`${name}: HTTP ${response?.status()} ${result.url}`);
console.log(`  title: ${result.title}`);
console.log(`  h1:    ${JSON.stringify(result.h1)}`);
console.log(`  saved: ${file} (${Math.round(result.html.length / 1024)} kB)`);
