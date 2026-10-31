// Renders src/assets/icon.svg to the PNG sizes the stores and manifest need.
// Usage: node tools/render-icons.mjs
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svg = await readFile(join(root, 'src/assets/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
// Chrome Web Store guidance: the 128 px icon is 96 px artwork with 16 px transparent padding.
// Small toolbar sizes stay full-bleed so they remain legible.
const PADDING = { 128: 16 };
for (const size of [16, 32, 48, 96, 128]) {
  const pad = PADDING[size] ?? 0;
  const art = size - 2 * pad;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${art}px;height:${art}px;margin:${pad}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: join(root, `public/icon/${size}.png`), omitBackground: true });
}
await browser.close();
