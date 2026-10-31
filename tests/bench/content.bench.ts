import { expect, test } from 'vitest';
import { findCsfdUrls } from '@/lib/csfd-url';
import { collectTextNodes, linkifyTextNode } from '@/lib/linkify';

// Budgets are generous (CI machines are slow) but catch order-of-magnitude regressions.

const noCsfd = 'Lorem ipsum dolor sit amet, https://example.com/x '.repeat(200);
const withCsfd = `${noCsfd} https://www.csfd.cz/film/1393489-to-vitejte-v-derry/1919339-a-story-of-derry/prehled/ ${noCsfd}`;

/** A large forum-like page: 10 000 paragraphs, 200 of them with a ČSFD URL. */
function buildPage(): void {
  const parts: string[] = [];
  for (let i = 0; i < 10_000; i++) {
    parts.push(
      i % 50 === 0
        ? `<p>Film ${i}: https://www.csfd.cz/film/${i + 1}-nazev-filmu/prehled/ a další text.</p>`
        : `<p>Obyčejný příspěvek číslo ${i} s textem a odkazem https://example.com/${i}.</p>`,
    );
  }
  document.body.innerHTML = parts.join('');
}

test('URL detection on 10–20 kB text blocks', { retry: 2 }, async ({ bench }) => {
  const plain = await bench('findCsfdUrls – 10 kB, no ČSFD', () => {
    findCsfdUrls(noCsfd);
  }).run();
  const oneUrl = await bench('findCsfdUrls – 20 kB, one ČSFD URL', () => {
    findCsfdUrls(withCsfd);
  }).run();
  // ≥ 2 000 ops/s ⇒ ≤ 0.5 ms per text block.
  expect(plain.throughput.mean).toBeGreaterThan(2_000);
  expect(oneUrl.throughput.mean).toBeGreaterThan(1_000);
});

test('collect + linkify a 10 000-paragraph page', { retry: 2 }, async ({ bench }) => {
  const result = await bench(
    'collect + linkify – 10 000 paragraphs, 200 links',
    { beforeEach: buildPage },
    () => {
      for (const node of collectTextNodes(document.body)) {
        linkifyTextNode(node);
      }
    },
  ).run();
  // ≥ 5 ops/s ⇒ ≤ 200 ms for the whole page, spread over idle callbacks in production.
  expect(result.throughput.mean).toBeGreaterThan(5);
});
