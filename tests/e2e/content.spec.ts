import { fixture } from '../helpers/fixtures';
import { expect, SITE, test } from './extension';

const badges = '[data-csfd-linker="badge"]';
const badge = (n: number) => `${badges} >> nth=${n} >> a`;
const links = 'a[data-csfd-linker="link"]';
const AUTO_LOAD_LIMIT = 10;

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('opens the welcome page right after installation', async ({ context }) => {
  const welcome =
    context.pages().find((p) => p.url().endsWith('/welcome.html')) ??
    (await context.waitForEvent('page', { predicate: (p) => p.url().endsWith('/welcome.html') }));
  await expect(welcome.locator('h1')).toHaveText(/ČSFD/);
  await expect(welcome.locator('.legend .pill')).toHaveCount(4);
  await welcome.screenshot({ path: 'test-results/welcome.png' });
});

test('linkifies plain-text URLs and loads visible ratings right away', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);

  const link = page.locator(links, { hasText: '1700849-coutures' });
  await expect(link).toHaveAttribute('href', 'https://www.csfd.cz/film/1700849-coutures/prehled/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator(badges)).toHaveCount(3);
  await expect(page.locator(`${badges} a`)).toHaveText(['65 %', '65 %', '65 %']);
  await expect(page.locator(badge(0))).toHaveAttribute('title', /Coutures & spol\. – 65 %/);
  expect([...csfdRequests].sort()).toEqual([
    'https://www.csfd.cz/film/1700849/prehled/',
    'https://www.csfd.cz/film/1773198/prehled/',
    'https://www.csfd.cz/film/6/prehled/',
  ]);
});

test('serves ratings from the cache on the next visit', async ({ context, csfdRequests }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  await expect(page.locator(`${badges} a`)).toHaveText(['65 %', '65 %', '65 %']);
  const before = csfdRequests.length;
  await page.reload();
  await expect(page.locator(`${badges} a`)).toHaveText(['65 %', '65 %', '65 %']);
  expect(csfdRequests).toHaveLength(before);
});

test(`loads the first ${AUTO_LOAD_LIMIT} films automatically, the rest on hover`, async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/many-films.html`);
  await expect(page.locator(badges)).toHaveCount(15);
  await expect(page.locator(badge(AUTO_LOAD_LIMIT - 1))).toHaveText('65 %');
  await expect(page.locator(badge(AUTO_LOAD_LIMIT))).toHaveText('ČSFD');
  expect(csfdRequests).toHaveLength(AUTO_LOAD_LIMIT);

  await page.locator(links).nth(12).hover();
  await expect(page.locator(badge(12))).toHaveText('65 %');
  expect(csfdRequests).toHaveLength(AUTO_LOAD_LIMIT + 1);
});

test('page scripts cannot trigger requests beyond the automatic ones', async ({
  context,
  csfdRequests,
}) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/many-films.html`);
  await expect(page.locator(badge(AUTO_LOAD_LIMIT - 1))).toHaveText('65 %');
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a')) {
      a.dispatchEvent(new MouseEvent('mouseenter'));
      a.focus();
    }
  });
  await page.waitForTimeout(500);
  expect(csfdRequests).toHaveLength(AUTO_LOAD_LIMIT);
});

test('keyboard users get the rating by tabbing to a link', async ({ context, csfdRequests }) => {
  const page = await context.newPage();
  await page.goto(`${SITE}/many-films.html`);
  await expect(page.locator(badge(AUTO_LOAD_LIMIT - 1))).toHaveText('65 %');
  await page.locator('#before-11').focus();
  await page.keyboard.press('Tab'); // real key press → focus moves to film 11
  await expect(page.locator(badge(AUTO_LOAD_LIMIT))).toHaveText('65 %');
  expect(csfdRequests).toHaveLength(AUTO_LOAD_LIMIT + 1);
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
  await expect(page.locator(badge(0))).toHaveText('ČSFD !');
  await page.waitForTimeout(1000);
  // Only requests already in flight when the first block arrived (concurrency 2).
  expect(csfdRequests.length).toBeLessThanOrEqual(2);
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
  await expect(page.locator(links)).toHaveCount(0);
  await expect(page.locator(badges)).toHaveCount(0);
});

test('tooltip mode inserts nothing; the card follows hover and disappears', async ({
  context,
  extensionId,
  csfdRequests,
}) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#display').selectOption('tooltip');
  await expect(options.locator('#status')).not.toBeEmpty();

  const page = await context.newPage();
  await page.goto(`${SITE}/warcenter-like.html`);
  const link = page.locator(links).first();
  await expect(link).toBeVisible();
  await expect(page.locator(badges)).toHaveCount(0);
  expect(csfdRequests).toEqual([]);

  const card = page.locator('[data-csfd-linker="card"]');
  await link.hover();
  await expect(card.locator('.pill')).toHaveText('65 %');
  await expect(card).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(card).toBeHidden();
});
