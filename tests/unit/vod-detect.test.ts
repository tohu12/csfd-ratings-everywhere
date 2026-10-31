import { describe, expect, it } from 'vitest';
import {
  cleanDocumentTitle,
  detectTitle,
  findSite,
  normalizeTitle,
  VOD_SITES,
} from '@/lib/vod/detect';
import { fixture } from '../helpers/fixtures';

// Invisible marks the real pages wrap titles in: left-to-right mark, first-strong isolate, pop isolate.
const LRM = String.fromCodePoint(0x200e);
const FSI = String.fromCodePoint(0x2068);
const PDI = String.fromCodePoint(0x2069);

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const page = (name: string) => parse(fixture(`pages/vod/${name}.html`));

function detect(name: string, url: string) {
  const site = findSite(new URL(url).hostname);
  if (!site) {
    throw new Error(`no site for ${url}`);
  }
  return detectTitle(page(name), new URL(url), site);
}

describe('normalizeTitle', () => {
  it('folds case, diacritics, punctuation and invisible characters', () => {
    expect(normalizeTitle(`${FSI}Špetka  lásky!${PDI}`)).toBe('spetka lasky');
    expect(normalizeTitle(`${LRM}Mission: Impossible – Odplata`)).toBe(
      'mission impossible odplata',
    );
  });
});

describe('cleanDocumentTitle', () => {
  it('strips the brand after the last separator', () => {
    expect(cleanDocumentTitle('Lupin – Netflix', 'Netflix')).toBe('Lupin');
    expect(cleanDocumentTitle(`${FSI}Salted Love${PDI} • HBO Max`, 'HBO Max')).toBe('Salted Love');
    expect(cleanDocumentTitle('Kauza Theranos | Disney+', 'Disney+')).toBe('Kauza Theranos');
  });

  it('strips a leading "Watch" and keeps separators inside the film name', () => {
    expect(cleanDocumentTitle(`${LRM}Watch F1 The Movie - Apple TV`, 'Apple TV')).toBe(
      'F1 The Movie',
    );
    expect(cleanDocumentTitle('Sledujte Mission: Impossible - Odplata | Disney+', 'Disney+')).toBe(
      'Mission: Impossible - Odplata',
    );
  });

  it('strips a leading brand', () => {
    expect(cleanDocumentTitle('Netflix – Lupin', 'Netflix')).toBe('Lupin');
  });

  it('returns null when nothing but the brand is left', () => {
    expect(cleanDocumentTitle('Netflix', 'Netflix')).toBeNull();
    expect(cleanDocumentTitle('', 'Netflix')).toBeNull();
  });
});

describe('findSite', () => {
  it('matches the host and its subdomains', () => {
    expect(findSite('www.netflix.com')?.brand).toBe('Netflix');
    expect(findSite('netflix.com')?.brand).toBe('Netflix');
    expect(findSite('tv.apple.com')?.brand).toBe('Apple TV');
  });

  it('does not match look-alike hosts', () => {
    expect(findSite('notnetflix.com')).toBeNull();
    expect(findSite('example.com')).toBeNull();
  });

  it('lists every supported host once', () => {
    const hosts = VOD_SITES.map((s) => s.host);
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});

describe('detectTitle on real pages', () => {
  it('Netflix film in the detail modal', () => {
    const found = detect('netflix-film', 'https://www.netflix.com/browse/genre/34399?jbv=814862');
    expect(found).toMatchObject({ titles: ['Není úniku'], year: 1993, kind: 'film' });
    expect(found?.anchor?.className).toBe('year');
  });

  it('Netflix series in the detail modal', () => {
    const found = detect('netflix-series', 'https://www.netflix.com/title/80994082');
    expect(found).toMatchObject({ titles: ['Lupin'], year: 2026, kind: 'series' });
  });

  it('Disney+ film', () => {
    const found = detect(
      'disney-film',
      'https://www.disneyplus.com/cs-cz/browse/entity-293ff28f-94bc-4065-89aa-22e59017b3c1',
    );
    expect(found).toMatchObject({ titles: ['Hokus pokus 2'], year: 2022, kind: 'film' });
    expect(found?.anchor?.getAttribute('data-testid')).toBe('masthead-metadata');
  });

  it('Disney+ series', () => {
    const found = detect(
      'disney-series',
      'https://www.disneyplus.com/cs-cz/browse/entity-13988f84-f1c8-40dd-a73c-4e71ab4bbe63',
    );
    expect(found).toMatchObject({ titles: ['Kauza Theranos'], year: 2022, kind: 'series' });
  });

  it('HBO Max film: Czech logo title first, English document title second', () => {
    const found = detect(
      'hbomax-film',
      'https://www.hbomax.com/movie/9b3243d7-3d70-4b72-aaf3-fcbd3489e7d7',
    );
    expect(found).toMatchObject({
      titles: ['Nestvůra', 'The Beast Within'],
      year: 2024,
      kind: 'film',
    });
    expect(found?.anchor?.getAttribute('data-testid')).toBe('metadata_release_year');
  });

  it('HBO Max series is recognised by its URL despite an episode duration', () => {
    const found = detect(
      'hbomax-series',
      'https://www.hbomax.com/show/cfeee188-e698-4ad8-b8a9-0a53fdf20e9b',
    );
    expect(found).toMatchObject({
      titles: ['Špetka lásky', 'Salted Love'],
      year: 2026,
      kind: 'series',
    });
  });

  it('Apple TV film: generic detection, year next to the duration (not the award year)', () => {
    const found = detect(
      'appletv-film',
      'https://tv.apple.com/cz/movie/f1-the-movie/umc.cmc.3t6dvnnr87zwd4wmvpdx5came',
    );
    expect(found).toMatchObject({ titles: ['F1 The Movie'], year: 2025, kind: 'film' });
    expect(found?.anchor).not.toBeNull();
  });
});

describe('detectTitle without a detail view', () => {
  const netflix = VOD_SITES.find((s) => s.brand === 'Netflix');
  const apple = VOD_SITES.find((s) => s.brand === 'Apple TV');

  it('returns null when the site root is missing (Netflix home, no modal)', () => {
    const doc = parse('<title>Domovská obrazovka – Netflix</title><h1>Domovská obrazovka</h1>');
    expect(
      netflix && detectTitle(doc, new URL('https://www.netflix.com/browse'), netflix),
    ).toBeNull();
  });

  it('returns null when the root has no title element', () => {
    const doc = parse(
      '<title>Lupin – Netflix</title><div class="previewModal--wrapper detail-modal"></div>',
    );
    expect(
      netflix && detectTitle(doc, new URL('https://www.netflix.com/browse'), netflix),
    ).toBeNull();
  });

  it('falls back to the title element when the site anchor and year are missing', () => {
    const doc = parse(
      '<title>Lupin – Netflix</title><div class="previewModal--wrapper detail-modal">' +
        '<div class="about-header"><h3>O pořadu <strong>Lupin</strong></h3></div></div>',
    );
    const found = netflix && detectTitle(doc, new URL('https://www.netflix.com/browse'), netflix);
    expect(found).toMatchObject({ titles: ['Lupin'], year: null, kind: null });
    expect(found?.anchor?.tagName).toBe('STRONG');
  });

  it('returns null for a generic page whose heading does not match the document title', () => {
    const doc = parse('<title>Watch Something - Apple TV</title><h1>Browse</h1><p>2025 · 2h</p>');
    expect(apple && detectTitle(doc, new URL('https://tv.apple.com/cz'), apple)).toBeNull();
  });

  it('returns null for a generic page without a document title', () => {
    const doc = parse('<h1>Browse</h1>');
    expect(apple && detectTitle(doc, new URL('https://tv.apple.com/cz'), apple)).toBeNull();
  });

  it('returns null for an article-like page: matching heading but no year or kind', () => {
    const doc = parse('<title>Top picks - Apple TV</title><h2>Top picks</h2><p>Lorem ipsum.</p>');
    expect(apple && detectTitle(doc, new URL('https://tv.apple.com/cz/room/x'), apple)).toBeNull();
  });
});

describe('detectTitle generic heuristics', () => {
  const apple = VOD_SITES.find((s) => s.brand === 'Apple TV');
  const run = (body: string, path = '/cz/x') =>
    apple &&
    detectTitle(
      parse(`<title>Watch Duna - Apple TV</title>${body}`),
      new URL(`https://tv.apple.com${path}`),
      apple,
    );

  it('matches an image alt as the title and anchors next to it', () => {
    const found = run('<img alt="Duna"><p>2021 · 2h 35m</p>');
    expect(found).toMatchObject({ titles: ['Duna'], year: 2021, kind: 'film' });
    expect(found?.anchor?.tagName).toBe('IMG');
  });

  it('reads series from season words and from the URL', () => {
    expect(run('<h1>Duna</h1><p>2024 • 2 řady</p>')).toMatchObject({ kind: 'series', year: 2024 });
    expect(run('<h1>Duna</h1><p>Rok: 2024</p>', '/cz/show/duna')).toMatchObject({
      kind: 'series',
      year: 2024,
    });
    expect(run('<h1>Duna</h1><p>Minisérie</p>')).toMatchObject({ kind: 'series', year: null });
  });

  it('reads the year after a duration and from a "Rok:" label', () => {
    expect(run('<h1>Duna</h1><p>2 h 4 m</p><p>2021</p>')).toMatchObject({
      year: 2021,
      kind: 'film',
    });
    expect(run('<h1>Duna</h1><p>Year: 2021</p>', '/cz/movie/duna')).toMatchObject({
      year: 2021,
      kind: 'film',
    });
  });

  it('ignores a lone year that is not next to a duration', () => {
    expect(run('<h1>Duna</h1><p>2026 Oscar® Winner</p><p>1 h 40 min</p>')).toMatchObject({
      year: null,
      kind: 'film',
    });
  });

  it('dedupes titles that only differ in case or diacritics', () => {
    expect(run('<h1>DUNA</h1><p>2021 · 2h</p>')).toMatchObject({ titles: ['DUNA'] });
  });
});

describe('detectTitle reads year and kind from the metadata row only', () => {
  const netflix = VOD_SITES.find((s) => s.brand === 'Netflix');
  const apple = VOD_SITES.find((s) => s.brand === 'Apple TV');
  const modal = (meta: string, synopsis: string) =>
    parse(
      '<title>Mission: Impossible – Netflix</title>' +
        '<div class="previewModal--wrapper detail-modal">' +
        `<div class="videoMetadata--container"><div class="videoMetadata--line">${meta}</div></div>` +
        `<p class="synopsis">${synopsis}</p>` +
        '<div class="about-header"><h3>O filmu <strong>Mission: Impossible</strong></h3></div></div>',
    );
  const run = (doc: Document) =>
    netflix && detectTitle(doc, new URL('https://www.netflix.com/browse?jbv=1'), netflix);

  it('ignores season words in the synopsis of a film', () => {
    const doc = modal(
      '<div class="year">1996</div><span>1 h 50 min</span>',
      'Po 2 sériích misí… 3 řady agentů.',
    );
    expect(run(doc)).toMatchObject({ year: 1996, kind: 'film' });
  });

  it('does not read inflected Czech words as a season count', () => {
    const doc = modal('<div class="year">2010</div><span>v 10 sezónách</span>', '');
    expect(run(doc)).toMatchObject({ kind: null });
  });

  it('leaves the kind open when the row has both a duration and a season count', () => {
    const doc = modal('<div class="year">2020</div><span>1 h 5 m</span><span>2 řady</span>', '');
    expect(run(doc)).toMatchObject({ kind: null });
  });

  it('has no kind or year when the metadata row is missing', () => {
    const doc = parse(
      '<title>Duna – Netflix</title><div class="previewModal--wrapper detail-modal">' +
        '<p>2021 · 2 h 35 m</p><div class="about-header"><strong>Duna</strong></div></div>',
    );
    expect(run(doc)).toMatchObject({ titles: ['Duna'], year: null, kind: null });
  });

  it('skips script and style contents in generic detection', () => {
    const doc = parse(
      '<title>Watch Duna - Apple TV</title><h1>Duna</h1>' +
        '<script>{"releaseYear":"1984 · 2 h 17 m"}</script><style>.x{}</style><p>Sci-fi</p>',
    );
    expect(apple && detectTitle(doc, new URL('https://tv.apple.com/cz/x'), apple)).toBeNull();
  });

  it('caps the scanned text and copes with long digit runs', () => {
    const digits = '9'.repeat(50_000);
    const doc = parse(
      `<title>Watch Duna - Apple TV</title><h1>Duna</h1><p>${digits}</p><p>${'x '.repeat(20_000)}</p><p>2021 · 2h</p>`,
    );
    const found = apple && detectTitle(doc, new URL('https://tv.apple.com/cz/x'), apple);
    // The year sits beyond the 10 000-character text budget.
    expect(found).toBeNull();
  });
});
