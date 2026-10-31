import { expect, NETFLIX, test } from './extension';

const badge = '[data-csfd-linker="badge"] >> a';

/** What Netflix does when a tile is clicked: the detail modal appears and the title changes. */
const DETAIL_MODAL = `
  <div class="previewModal--wrapper detail-modal">
    <div class="videoMetadata--container"><div class="videoMetadata--line">
      <div class="year">2021</div><span class="duration">2 h 35 m</span>
    </div></div>
    <div class="about-header"><h3>O filmu <strong>Duna</strong></h3></div>
  </div>`;

test('looks a Netflix title up only once its detail view opens', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${NETFLIX}/browse`);
  await page.waitForTimeout(500);
  expect(csfdRequests).toEqual([]);
  await expect(page.locator(badge)).toHaveCount(0);

  await page.evaluate((html) => {
    document.title = 'Duna – Netflix';
    document.querySelector('main')?.insertAdjacentHTML('beforeend', html);
  }, DETAIL_MODAL);

  await expect(page.locator(badge)).toHaveText('65 %');
  await expect(page.locator(badge)).toHaveAttribute(
    'href',
    'https://www.csfd.cz/film/1234/prehled/',
  );
  expect(csfdRequests).toEqual([
    'https://www.csfd.cz/hledat/?q=Duna',
    'https://www.csfd.cz/film/1234/prehled/',
  ]);

  // Closing the modal removes the badge; reopening it answers without new requests.
  await page.evaluate(() => document.querySelector('.previewModal--wrapper')?.remove());
  await expect(page.locator(badge)).toHaveCount(0);
  await page.evaluate((html) => {
    document.querySelector('main')?.insertAdjacentHTML('beforeend', html);
  }, DETAIL_MODAL);
  await expect(page.locator(badge)).toHaveText('65 %');
  expect(csfdRequests).toHaveLength(2);
});

test('shows "ČSFD ?" linking to the search when ČSFD has no certain match', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${NETFLIX}/browse?jbv=814862&fixture=netflix-film`);
  await expect(page.locator(badge)).toHaveText('ČSFD ?');
  await expect(page.locator(badge)).toHaveAttribute(
    'href',
    'https://www.csfd.cz/hledat/?q=Nen%C3%AD%20%C3%BAniku',
  );
});
