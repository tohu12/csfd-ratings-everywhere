import { fixture } from '../helpers/fixtures';
import { expect, SITE, test } from './extension';

const badges = '[data-csfd-linker="badge"]';
const firstBadge = `${badges} a >> nth=0`;
const coutures = 'a[data-csfd-linker="link"]';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('turns plain-text ČSFD URLs into links with idle badges and no requests', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);

  const link = page.locator(coutures, { hasText: '1700849-coutures' });
  await expect(link).toHaveAttribute('href', 'https://www.csfd.cz/film/1700849-coutures/prehled/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator(badges)).toHaveCount(3);
  await expect(page.locator(firstBadge)).toHaveText('ČSFD');
  await page.waitForTimeout(500);
  expect(csfdRequests).toEqual([]);
});

test('loads the rating after a real hover and serves it from cache next time', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await page.locator(coutures).first().hover();
  await expect(page.locator(firstBadge)).toHaveText('65 %');
  await expect(page.locator(firstBadge)).toHaveAttribute('title', /Coutures & spol\. – 65 %/);
  expect(csfdRequests).toEqual(['https://www.csfd.cz/film/1700849/prehled/']);

  await page.reload();
  // Cached ratings appear as soon as the badge is visible, without any hover or request.
  await expect(page.locator(firstBadge)).toHaveText('65 %');
  expect(csfdRequests).toHaveLength(1);
});

test('a page script cannot trigger requests', async ({ context, csfdRequests }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await expect(page.locator(badges)).toHaveCount(3);
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a')) {
      a.dispatchEvent(new MouseEvent('mouseenter'));
      a.focus();
    }
  });
  await page.waitForTimeout(500);
  expect(csfdRequests).toEqual([]);
});

test('keyboard users get the rating by tabbing to a link', async ({ context, csfdRequests }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await expect(page.locator(badges)).toHaveCount(3);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  // Tab until the first ČSFD link has focus (real key presses → trusted events).
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-csfd-linker'),
    );
    if (focused === 'link') {
      break;
    }
  }
  await expect(page.locator(firstBadge)).toHaveText('65 %');
  expect(csfdRequests).toEqual(['https://www.csfd.cz/film/1700849/prehled/']);
});

test('leaves code, textarea and editors alone', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await expect(page.locator(badges)).toHaveCount(3);
  await expect(page.locator(`#skipped ${badges}`)).toHaveCount(0);
  await expect(page.locator('#skipped a[data-csfd-linker]')).toHaveCount(0);
});

test('shows the blocked state and pauses after an Anubis page', async ({
  context,
  csfdPages,
  csfdRequests,
}) => {
  for (const id of [1700849, 1773198, 6]) {
    csfdPages.set(id, { status: 200, body: fixture('csfd/anubis-reject.html') });
  }
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await page.locator(coutures).first().hover();
  await expect(page.locator(firstBadge)).toHaveText('ČSFD !');
  await page.locator('#ext').hover();
  await expect(page.locator(`${badges} a`).nth(0)).toHaveText('ČSFD !');
  await page.waitForTimeout(500);
  expect(csfdRequests).toHaveLength(1);
});

test('the options page can disable a site', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await expect(page.locator(badges)).toHaveCount(3);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#global-toggle')).toBeChecked();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#disabled-hosts').fill('warcenter.test');
  await options.locator('#disabled-hosts').blur();
  await expect(options.locator('#status')).not.toBeEmpty();

  await page.reload();
  await expect(page.locator('a[data-csfd-linker="link"]')).toHaveCount(0);
  await expect(page.locator(badges)).toHaveCount(0);
});

test('tooltip mode inserts nothing; the card follows hover and disappears', async ({
  context,
  extensionId,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#display').selectOption('tooltip');
  await expect(options.locator('#status')).not.toBeEmpty();

  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  const link = page.locator(coutures).first();
  await expect(link).toBeVisible();
  await expect(page.locator(badges)).toHaveCount(0);

  const card = page.locator('[data-csfd-linker="card"]');
  await link.hover();
  await expect(card.locator('.pill')).toHaveText('65 %');
  await expect(card).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(card).toBeHidden();
});
