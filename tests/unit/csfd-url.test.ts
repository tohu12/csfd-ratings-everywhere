import { describe, expect, it } from 'vitest';
import { findCsfdUrls, mightContainCsfd, parseCsfdUrl, ratingUrl } from '@/lib/csfd-url';

describe('mightContainCsfd', () => {
  it.each([
    ['see https://www.csfd.cz/film/1', true],
    ['CSFD.CZ', true],
    ['csfd without dot', false],
    ['', false],
    [null, false],
  ])('%j → %s', (text, expected) => {
    expect(mightContainCsfd(text)).toBe(expected);
  });
});

describe('findCsfdUrls', () => {
  // Real URLs from the warcenter.cz sample pages.
  it.each([
    ['https://www.csfd.cz/film/1700849-coutures/prehled/', 1700849],
    ['https://www.csfd.cz/film/1773198-poberta', 1773198],
    [
      'https://www.csfd.cz/film/1393489-to-vitejte-v-derry/1919339-a-story-of-derry/prehled/',
      1919339,
    ],
    ['https://www.csfd.cz/film/1548867-jedeme-naprazdno/prehled/', 1548867],
  ])('recognises %s', (url, id) => {
    expect(findCsfdUrls(url)).toEqual([{ id, href: url, start: 0, end: url.length }]);
  });

  it.each([
    ['http://csfd.cz/film/10-a/', 10, 'https://csfd.cz/film/10-a/'],
    ['m.csfd.cz/film/11-b', 11, 'https://m.csfd.cz/film/11-b'],
    ['www.csfd.sk/film/12', 12, 'https://www.csfd.sk/film/12'],
    ['https://www.csfd.cz/sk/film/13-c/recenze/', 13, 'https://www.csfd.cz/sk/film/13-c/recenze/'],
    ['https://www.csfd.cz/en/film/14/', 14, 'https://www.csfd.cz/en/film/14/'],
    ['HTTPS://WWW.CSFD.CZ/FILM/15-X', 15, 'https://WWW.CSFD.CZ/FILM/15-X'],
    [
      'csfd.cz/film/1-serie/2-serie-1/3-epizoda-1/prehled/',
      3,
      'https://csfd.cz/film/1-serie/2-serie-1/3-epizoda-1/prehled/',
    ],
    ['https://www.csfd.cz/film/16-x/?page=2#a', 16, 'https://www.csfd.cz/film/16-x/?page=2#a'],
  ])('recognises variant %s', (url, id, href) => {
    expect(findCsfdUrls(url)).toEqual([{ id, href, start: 0, end: url.length }]);
  });

  it('finds several URLs among other text in one text node (warcenter layout)', () => {
    const text =
      'Jazyk: CZ\nhttps://fastshare.cloud/35411143/x.mkv\n\nMaxine https://www.csfd.cz/film/1700849-coutures/prehled/ a (www.csfd.cz/film/2-b).';
    const found = findCsfdUrls(text);
    expect(found.map((m) => [m.id, text.slice(m.start, m.end)])).toEqual([
      [1700849, 'https://www.csfd.cz/film/1700849-coutures/prehled/'],
      [2, 'www.csfd.cz/film/2-b'],
    ]);
  });

  it.each([
    'https://www.csfd.cz/film/5-a.',
    'https://www.csfd.cz/film/5-a,',
    'https://www.csfd.cz/film/5-a!?',
    'https://www.csfd.cz/film/5-a)]',
    'https://www.csfd.cz/film/5-a"',
  ])('strips trailing punctuation from %s', (text) => {
    expect(findCsfdUrls(text)[0]?.href).toBe('https://www.csfd.cz/film/5-a');
  });

  it.each([
    ['not a film page', 'https://www.csfd.cz/tvurce/1-x/'],
    ['user page', 'https://www.csfd.cz/uzivatel/1-x/'],
    ['search', 'https://www.csfd.cz/hledat/?q=film/1'],
    ['glued to a word', 'xcsfd.cz/film/1'],
    ['other domain', 'notcsfd.cz/film/1'],
    ['subpath of other site', 'example.com/csfd.cz/film/1'],
    ['email-like', 'me@csfd.cz/film/1'],
    ['zero id', 'csfd.cz/film/0-x'],
    ['unsafe integer id', 'csfd.cz/film/99999999999999999999'],
    ['no id', 'csfd.cz/film/abc'],
    ['other tld', 'csfd.com/film/1'],
  ])('ignores %s', (_, text) => {
    expect(findCsfdUrls(text)).toEqual([]);
  });

  it('stays linear on a long run of punctuation inside the URL', () => {
    const text = `csfd.cz/film/1${')'.repeat(50_000)}a`;
    const started = performance.now();
    expect(findCsfdUrls(text)[0]?.id).toBe(1);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('can be called repeatedly (no shared regex state)', () => {
    const text = 'csfd.cz/film/1 csfd.cz/film/2';
    expect(findCsfdUrls(text)).toHaveLength(2);
    expect(findCsfdUrls(text)).toHaveLength(2);
  });

  it('stays linear on adversarial input', () => {
    const text = `csfd.cz/film/1${'-a/1'.repeat(20_000)}${'x'.repeat(20_000)} `;
    const started = performance.now();
    findCsfdUrls(text);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('parseCsfdUrl', () => {
  it.each([
    ['https://www.csfd.cz/film/1773198-poberta', 1773198],
    ['http://m.csfd.cz/film/1-a/2-b/', 2],
    ['https://csfd.sk/film/3', 3],
    ['https://WWW.CSFD.CZ/sk/film/4-x/galerie/', 4],
  ])('parses %s', (url, id) => {
    expect(parseCsfdUrl(url)).toEqual({ id, href: new URL(url).href });
  });

  it.each([
    'not a url',
    'ftp://www.csfd.cz/film/1',
    'javascript:alert(1)//www.csfd.cz/film/1',
    'https://evil.example/film/1',
    'https://www.csfd.cz.evil.example/film/1',
    'https://www.csfd.cz/tvurce/1-a/',
    'https://www.csfd.cz/film/0',
    'https://www.csfd.cz/',
  ])('rejects %s', (url) => {
    expect(parseCsfdUrl(url)).toBeNull();
  });
});

describe('ratingUrl', () => {
  it('builds the canonical overview URL', () => {
    expect(ratingUrl(42)).toBe('https://www.csfd.cz/film/42/prehled/');
  });
});
