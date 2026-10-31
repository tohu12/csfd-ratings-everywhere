import { expect, test } from 'vitest';
import { detectTitle, findSite } from '@/lib/vod/detect';

// The VOD script re-checks the page every 300 ms while it mutates, so one check must stay cheap
// even on pages with big inline data scripts (generic detection walks the whole body).

/** An Apple TV-like detail page: a 1 MB inline JSON script, 300 tiles and a 20 000-digit run. */
function buildPage(): void {
  const tiles = Array.from(
    { length: 300 },
    (_, i) => `<li><img alt="Film ${i}"><span>${i} min</span></li>`,
  );
  document.title = 'Watch Duna - Apple TV';
  document.body.innerHTML =
    `<script type="application/json">${JSON.stringify({ data: 'x'.repeat(1_000_000) })}</script>` +
    `<h1>Duna</h1><p>2021 · 2h 35m</p><p>${'9'.repeat(20_000)}</p><ul>${tiles.join('')}</ul>`;
}

test('detectTitle on a heavy generic page', { retry: 2 }, async ({ bench }) => {
  const site = findSite('tv.apple.com');
  const url = new URL('https://tv.apple.com/cz/movie/duna/umc.1');
  expect(site && detectTitle(document, url, site)).toBeNull(); // page not built yet
  buildPage();
  expect(site && detectTitle(document, url, site)).toMatchObject({ year: 2021, kind: 'film' });
  const result = await bench('detectTitle – 1 MB script, 300 tiles', () => {
    if (site) {
      detectTitle(document, url, site);
    }
  }).run();
  // ≥ 200 ops/s ⇒ ≤ 5 ms per check (happy-dom is far slower than a browser).
  expect(result.throughput.mean).toBeGreaterThan(200);
});
