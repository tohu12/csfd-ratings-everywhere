import { expect, NETFLIX, test } from './extension';

const badge = '[data-csfd-linker="badge"] >> a';

// The user-activation gate (SPEC §4b) is covered by unit tests and the manual check: Chromium
// under Playwright reports `navigator.userActivation.hasBeenActive` shortly after load anyway.
test('looks a Netflix title up once its detail view opens', async ({ context, csfdRequests }) => {
  const page = await context.newPage();
  // The page's own script opens the detail modal, as Netflix does after a tile click.
  await page.goto(`${NETFLIX}/browse?fixture=netflix-scripted`);
  await page.mouse.click(5, 5);
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
  const modal = await page.evaluate(() => {
    const el = document.querySelector('.previewModal--wrapper');
    el?.remove();
    return el?.outerHTML ?? '';
  });
  await expect(page.locator(badge)).toHaveCount(0);
  await page.evaluate((html) => {
    document.querySelector('main')?.insertAdjacentHTML('beforeend', html);
  }, modal);
  await expect(page.locator(badge)).toHaveText('65 %');
  expect(csfdRequests).toHaveLength(2);
});

test('loads nothing while browse rows render without a detail view', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${NETFLIX}/browse`);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(700);
  await expect(page.locator(badge)).toHaveCount(0);
  expect(csfdRequests).toEqual([]);
});

test('shows "ČSFD ?" linking to the search when ČSFD has no certain match', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${NETFLIX}/browse?jbv=814862&fixture=netflix-film`);
  await page.mouse.click(5, 5);
  await expect(page.locator(badge)).toHaveText('ČSFD ?');
  await expect(page.locator(badge)).toHaveAttribute(
    'href',
    'https://www.csfd.cz/hledat/?q=Nen%C3%AD%20%C3%BAniku',
  );
});
