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
const APPLE_MOVIE = 'https://tv.apple.com/cz/movie/x/umc.1';
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

  it('JustWatch film: heading without its "(2023)", year from the year element', () => {
    const found = detect('justwatch-film', 'https://www.justwatch.com/cz/film/oppenheimer');
    expect(found).toMatchObject({ titles: ['Oppenheimer'], year: 2023, kind: 'film' });
    expect(found?.anchor?.className).toBe('release-year');
  });

  it('JustWatch series: the original title instead of the marketing document title', () => {
    const found = detect('justwatch-series', 'https://www.justwatch.com/cz/serial/the-office');
    expect(found).toMatchObject({ titles: ['Kancl', 'The Office'], year: 2001, kind: 'series' });
  });

  it('JustWatch: an original title equal to the heading is not repeated', () => {
    const justwatch = findSite('www.justwatch.com');
    const doc = parse(
      '<title>Duna – kde sledovat</title><div class="title-detail-hero">' +
        '<h1 class="title-detail-hero__details__title">Duna<span class="release-year"> (2021)</span></h1>' +
        '<h3 class="original-title">Pôvodný názov: DUNA</h3></div>',
    );
    const found =
      justwatch && detectTitle(doc, new URL('https://www.justwatch.com/sk/film/duna'), justwatch);
    expect(found).toMatchObject({ titles: ['Duna'], year: 2021, kind: 'film' });
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
    expect(apple && detectTitle(doc, new URL(APPLE_MOVIE), apple)).toBeNull();
  });

  it('returns null for a generic page without a document title', () => {
    const doc = parse('<h1>Browse</h1>');
    expect(apple && detectTitle(doc, new URL(APPLE_MOVIE), apple)).toBeNull();
  });

  it('never takes the URL alone as proof of a detail page', () => {
    const doc = parse('<title>Top picks - Apple TV</title><h2>Top picks</h2><p>Lorem ipsum.</p>');
    expect(apple && detectTitle(doc, new URL(APPLE_MOVIE), apple)).toBeNull();
  });
});

describe('detectTitle generic heuristics', () => {
  const prime = VOD_SITES.find((s) => s.brand === 'Prime Video');
  const apple = VOD_SITES.find((s) => s.brand === 'Apple TV');
  const run = (body: string) =>
    prime &&
    detectTitle(
      parse(`<title>Prime Video: Duna</title>${body}`),
      new URL('https://www.primevideo.com/detail/X'),
      prime,
    );
  const onApple = (body: string, path: string) =>
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
    expect(onApple('<h1>Duna</h1><p>Rok: 2024</p>', '/cz/show/duna/umc.1')).toMatchObject({
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
    expect(onApple('<h1>Duna</h1><p>Year: 2021</p>', '/cz/movie/duna/umc.1')).toMatchObject({
      year: 2021,
      kind: 'film',
    });
  });

  it('reads durations in minutes spelled out, as "2h52" and as a range of episode lengths', () => {
    expect(run('<h1>Duna</h1><p>2021 · 155 minut</p>')).toMatchObject({ year: 2021, kind: 'film' });
    expect(run('<h1>Duna</h1><p>Drama 155 minutes 2021</p>')).toMatchObject({
      year: 2021,
      kind: 'film',
    });
    expect(run('<h1>Duna</h1><p>Drama 2h52 2021</p>')).toMatchObject({ year: 2021, kind: 'film' });
    expect(run('<h1>Duna</h1><p>Drama 2h52m 2021</p>')).toMatchObject({ year: 2021 });
    expect(run('<h1>Duna</h1><p>krimi 2026 48 - 53m</p>')).toMatchObject({ year: 2026 });
  });

  it('reads the Slovak "séria" as a season count', () => {
    expect(run('<h1>Duna</h1><p>2024 · 1 séria</p>')).toMatchObject({ year: 2024, kind: 'series' });
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

describe('detectTitle on public pages of generically detected sites', () => {
  it.each([
    [
      'ct-film',
      'https://www.ceskatelevize.cz/porady/14106473148-wind-river/',
      ['Wind River'],
      2016,
      'film',
    ],
    [
      'ct-series',
      'https://www.ceskatelevize.cz/porady/10111864738-hercule-poirot/',
      ['Hercule Poirot'],
      null,
      'series',
    ],
    [
      'prime-film',
      'https://www.primevideo.com/detail/0FC3O0LQUX1IKRA19XD4UKJASF',
      ['Road House'],
      2024,
      'film',
    ],
    [
      'prime-series',
      'https://www.primevideo.com/detail/0K16R3PLUFGC2JUE457C26O4OD',
      ['Reacher'],
      2026,
      'series',
    ],
    [
      'skyshowtime-film',
      'https://www.skyshowtime.com/cz/stream/movies/top-gun-maverick/0c63',
      ['Top Gun: Maverick'],
      2022,
      'film',
    ],
    [
      'skyshowtime-series',
      'https://www.skyshowtime.com/cz/stream/tv/marshals/45b6',
      ['Marshals'],
      null,
      'series',
    ],
    [
      'oneplay-series',
      'https://www.oneplay.cz/porad/9486-extraktori',
      ['Extraktoři'],
      2026,
      'series',
    ],
    [
      'prima-film',
      'https://www.iprima.cz/filmy/prava-blondynka',
      ['Pravá blondýnka'],
      2001,
      'film',
    ],
    ['mubi-film', 'https://mubi.com/en/cz/films/perfect-days', ['PERFECT DAYS'], 2023, 'film'],
    [
      'voyo-sk-film',
      'https://voyo.markiza.sk/titul/7572-tiche-miesto',
      ['Tiché miesto'],
      2018,
      'film',
    ],
    // "2026 48 - 53m": the year sits next to a range of episode lengths.
    ['voyo-sk-series', 'https://voyo.markiza.sk/titul/9630-hriech', ['Hriech'], 2026, 'series'],
    // The year ("Norsko, 2024") is not next to the duration: the lookup goes by kind only.
    ['kviff-film', 'https://kviff.tv/videos/az-na-veky', ['Až na věky'], null, 'film'],
    // "2h52 2023": hours and minutes without a space or unit.
    [
      'canalplus-film',
      'https://www.canalplus.com/cz/cs/filmy/oppenheimer/h/42620108_55021',
      ['Oppenheimer'],
      2023,
      'film',
    ],
    [
      'canalplus-series',
      'https://www.canalplus.com/cz/cs/serialy/moloch/h/42010557_55021',
      ['Moloch'],
      null,
      'series',
    ],
    // The detail is a modal over the catalogue, addressed by query parameters.
    [
      'rakuten-film',
      'https://www.rakuten.tv/cz?content_type=movies&content_id=oppenheimer',
      ['Oppenheimer'],
      2023,
      'film',
    ],
  ] as const)('%s', (name, url, titles, year, kind) => {
    expect(detect(name, url)).toMatchObject({ titles, year, kind });
  });

  it('prefers a heading over a poster image as the badge anchor', () => {
    const found = detect('ct-film', 'https://www.ceskatelevize.cz/porady/14106473148-wind-river/');
    expect(found?.anchor?.tagName).toBe('H1');
  });

  it('ignores a category page whose heading matches its title', () => {
    expect(
      detect(
        'ct-category',
        'https://www.ceskatelevize.cz/ivysilani/kategorie/3976-serialy/4000-mysteriozni/',
      ),
    ).toBeNull();
  });

  it("ignores paths outside the site's detail sections (news on the same host)", () => {
    expect(detect('prima-film', 'https://www.iprima.cz/zpravy/prava-blondynka')).toBeNull();
  });
});

describe('detectTitle generic signals', () => {
  const prime = VOD_SITES.find((s) => s.brand === 'Prime Video');
  const run = (head: string, body: string, path = '/detail/x') =>
    prime &&
    detectTitle(
      parse(`<head>${head}</head><body>${body}</body>`),
      new URL(`https://www.primevideo.com${path}`),
      prime,
    );
  const ld = (value: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

  it('strips a "Brand:" prefix and a trailing "(year)", which also gives the year', () => {
    expect(
      run(
        '<title>Prime Video: Duna (2021)</title>',
        '<h1><img alt="Duna (2021)"></h1><p>Sci-fi</p>',
      ),
    ).toMatchObject({
      titles: ['Duna'],
      year: 2021,
      kind: null,
    });
  });

  it('takes the kind from a JSON-LD item with the same name, in a list or a @graph', () => {
    expect(
      run(
        `<title>Duna (2021)</title>${ld([
          { '@type': 'WebSite', name: 'x' },
          { '@type': 'Movie', name: 'Duna' },
        ])}`,
        '<h2>Duna</h2>',
      ),
    ).toMatchObject({ kind: 'film' });
    expect(
      run(
        `<title>Duna</title>${ld({ '@graph': [{ '@type': 'TVSeries', name: 'Duna' }] })}`,
        '<h2>Duna</h2>',
      ),
    ).toMatchObject({ kind: 'series', year: null });
  });

  it('ignores a JSON-LD name the document title does not start with (stale after navigation)', () => {
    expect(
      run(
        `<title>Sledujte online</title>${ld({ '@type': 'TVSeries', name: 'Duna' })}`,
        '<h2>Duna</h2>',
      ),
    ).toBeNull();
  });

  it('uses the JSON-LD name without an on-page element when the document title starts with it', () => {
    const found = run(
      `<title>Duna - celý film</title>${ld({ '@type': 'Movie', name: 'Duna' })}`,
      '<p>nothing</p>',
    );
    expect(found).toMatchObject({ titles: ['Duna'], kind: 'film', anchor: null });
    expect(
      run(`<title>Jiný film</title>${ld({ '@type': 'Movie', name: 'Duna' })}`, '<p>nothing</p>'),
    ).toBeNull();
  });

  it('ignores JSON-LD of another title, without a name, invalid or too large', () => {
    const head = (extra: string) => `<title>Duna</title>${extra}`;
    expect(run(head(ld({ '@type': 'Movie', name: 'Jiný' })), '<h2>Duna</h2>')).toBeNull();
    expect(run(head(ld({ '@type': 'Movie' })), '<h2>Duna</h2>')).toBeNull();
    expect(run(head(ld({ '@type': 'Movie', name: ' ' })), '<h2>Duna</h2>')).toBeNull();
    expect(run(head(ld('Movie')), '<h2>Duna</h2>')).toBeNull();
    expect(
      run(head('<script type="application/ld+json">{oops</script>'), '<h2>Duna</h2>'),
    ).toBeNull();
    const huge = ld({ '@type': 'Movie', name: 'Duna', padding: 'x'.repeat(100_000) });
    expect(run(head(huge), '<h2>Duna</h2>')).toBeNull();
  });

  it('takes the kind from og:type only when og:title names the same title', () => {
    const og = (title: string, type: string) =>
      `<title>Duna</title><meta property="og:title" content="${title}"><meta property="og:type" content="${type}">`;
    expect(run(og('Duna | Prime', 'video.movie'), '<h2>Duna</h2>')).toMatchObject({ kind: 'film' });
    expect(run(og('Duna | Prime', 'video.tv_show'), '<h2>Duna</h2>')).toMatchObject({
      kind: 'series',
    });
    expect(run(og('Duna | Prime', 'video.episode'), '<h2>Duna</h2>')).toMatchObject({
      kind: 'series',
    });
    expect(run(og('Duna | Prime', 'website'), '<h2>Duna</h2>')).toBeNull();
    expect(run(og('Jiný film', 'video.movie'), '<h2>Duna</h2>')).toBeNull();
    expect(
      run('<title>Duna</title><meta property="og:type" content="video.movie">', '<h2>Duna</h2>'),
    ).toBeNull();
  });

  it('refines the kind from Czech plural paths, but only next to a content signal', () => {
    const prima = VOD_SITES.find((x) => x.brand === 'prima+');
    const on = (path: string, body: string) =>
      prima &&
      detectTitle(
        parse(`<title>Duna online | prima+</title>${body}`),
        new URL(`https://www.iprima.cz${path}`),
        prima,
      );
    expect(on('/filmy/duna', '<h1>Duna</h1><p>2021 · 120 min</p>')).toMatchObject({
      kind: 'film',
      year: 2021,
    });
    expect(on('/serialy/duna', '<h1>Duna</h1><p>2021 · 50 min</p>')).toMatchObject({
      kind: 'series',
    });
    expect(on('/filmy/duna', '<h1>Duna</h1><p>Sci-fi</p>')).toBeNull();
  });

  it('looks for year and kind only in the nearest few ancestors of the title', () => {
    const deep =
      '<div><div><div><div><div><div><div><h2>Duna</h2></div></div></div></div></div></div></div>';
    expect(run('<title>Duna</title>', `${deep}<p>2021 · 2 h 35 m</p>`)).toBeNull();
    expect(
      run('<title>Duna</title>', `<section><h2>Duna</h2></section><p>2021 · 2 h 35 m</p>`),
    ).toMatchObject({ year: 2021 });
  });
});

describe('detectTitle never takes another title for the open one (review regressions)', () => {
  const site = (brand: string) => {
    const found = VOD_SITES.find((x) => x.brand === brand);
    if (!found) {
      throw new Error(brand);
    }
    return found;
  };
  /** `title` is the document title; `head` adds e.g. JSON-LD. */
  const run = (brand: string, url: string, title: string, body: string, head = '') =>
    detectTitle(
      parse(`<head><title>${title}</title>${head}</head><body>${body}</body>`),
      new URL(url),
      site(brand),
    );

  it('prefers the full title over a shorter prefix from a recommendation tile', () => {
    const body =
      '<h1><img alt="Road House 2 (2026)"></h1><div>2026 · 2 h 1 min</div>' +
      '<section><h3>Road House</h3><span>1989 · 1 h 54 min</span></section>';
    expect(
      run(
        'Prime Video',
        'https://www.primevideo.com/detail/X',
        'Prime Video: Road House 2 (2026)',
        body,
      ),
    ).toMatchObject({
      titles: ['Road House 2'],
      year: 2026,
    });
  });

  it('ignores titles inside links, even before the hero', () => {
    const body =
      '<a href="/cz/stream/movies/top-gun/1"><h3>Top Gun</h3><span>1986 · 1 h 50 min</span></a>' +
      '<div><img alt="Top Gun: Maverick"><p>2022 · 2h 10m</p></div>';
    expect(
      run(
        'SkyShowtime',
        'https://www.skyshowtime.com/cz/stream/movies/top-gun-maverick/0c63',
        'Sledujte Top Gun: Maverick nyní online | SkyShowtime',
        body,
      ),
    ).toMatchObject({ titles: ['Top Gun: Maverick'], year: 2022 });
  });

  it('ignores stale JSON-LD of the previous page', () => {
    const ldScript =
      '<script type="application/ld+json">{"@type":"TVSeries","name":"Extraktoři"}</script>';
    const body =
      '<h2>Studna</h2><p>2025 · 1 série</p><img alt="Extraktoři"><span>2026 · 1 řada</span>';
    expect(
      run(
        'Oneplay',
        'https://www.oneplay.cz/porad/10628-studna',
        'Studna - Sledujte celé díly online | Oneplay',
        body,
        ldScript,
      ),
    ).toMatchObject({ titles: ['Studna'], year: 2025 });
  });

  it('treats episode and season pages as no detail view', () => {
    const ldScript =
      '<script type="application/ld+json">{"@type":"TVEpisode","name":"Byt ve třetím patře"}</script>';
    const body = `${ldScript}<h2>Byt ve třetím patře</h2><p>1989 · 50 min</p>`;
    expect(
      run(
        'Česká televize',
        'https://www.ceskatelevize.cz/porady/1-poirot/',
        'Byt ve třetím patře - iVysílání | Česká televize',
        body,
      ),
    ).toBeNull();
  });

  it.each([
    ['Česká televize', 'https://www.ceskatelevize.cz/porady/10111864738-hercule-poirot/123-byt/'],
    ['Česká televize', 'https://www.ceskatelevize.cz/ivysilani/kategorie/3947-filmy/'],
    ['prima+', 'https://www.iprima.cz/serialy/zakony-vlka/zakony-vlka-iii/8-epizoda-8'],
    ['prima+', 'https://www.iprima.cz/filmy/'],
    ['Oneplay', 'https://www.oneplay.cz/p/1252-jaroslav-plesl'],
    ['Oneplay', 'https://www.oneplay.cz/porad/9486-extraktori/epizoda/4243068-6-dil'],
    ['Prime Video', 'https://www.primevideo.com/search/ref=atv_sr_sug?phrase=duna'],
    ['SkyShowtime', 'https://www.skyshowtime.com/cz'],
    ['Apple TV', 'https://tv.apple.com/cz/room/duna'],
    ['MUBI', 'https://mubi.com/en/cz/films/duna/trailer'],
    ['MUBI', 'https://mubi.com/en/cz/showing'],
    ['Voyo', 'https://voyo.markiza.sk/serialy/9630-hriech/epizoda/1-kolchoz'],
    ['Voyo', 'https://voyo.markiza.sk/filmy/zanre/166-thriller'],
    ['KVIFF.TV', 'https://kviff.tv/screens/filmy'],
    ['CANAL+', 'https://www.canalplus.com/cz/cs/filmy/'],
    ['CANAL+', 'https://www.canalplus.com/fr/cinema/duna/h/1_2'],
    ['JustWatch', 'https://www.justwatch.com/cz/serial/duna/rada-2'],
    ['JustWatch', 'https://www.justwatch.com/cz/novinky'],
  ])('ignores non-detail paths on %s: %s', (brand, url) => {
    expect(run(brand, url, 'Duna', '<h1>Duna</h1><p>2021 · 2 h 35 m</p>')).toBeNull();
  });

  it('ignores the Rakuten TV catalogue behind a closed detail (brand-only document title)', () => {
    expect(
      run(
        'Rakuten TV',
        'https://www.rakuten.tv/cz',
        'Rakuten TV',
        '<h2>Rakuten TV</h2><p>2021 · 2 h 35 m</p>',
      ),
    ).toBeNull();
  });

  it('stops looking for year and kind at a container with another heading', () => {
    const body =
      '<section><h2>Duna</h2><div><h3>Jiný film</h3><p>1989 · 1 h 54 min</p></div></section>';
    expect(
      run('Prime Video', 'https://www.primevideo.com/detail/X', 'Prime Video: Duna', body),
    ).toBeNull();
  });

  it('strips the brand only as a whole word', () => {
    expect(cleanDocumentTitle('Primadonky online – celý seriál | prima+', 'prima+')).toBe(
      'Primadonky online – celý seriál',
    );
  });

  it('matches a JSON-LD name only as whole words of the document title', () => {
    const ldScript = '<script type="application/ld+json">{"@type":"Movie","name":"Duna"}</script>';
    expect(
      run(
        'Prime Video',
        'https://www.primevideo.com/detail/X',
        'Dunaj – celý film',
        '<p>x</p>',
        ldScript,
      ),
    ).toBeNull();
  });

  it('expects a year on sites with a year hint, not on generic ones', () => {
    expect(detect('netflix-film', 'https://www.netflix.com/title/814862')?.yearExpected).toBe(true);
    expect(
      detect('disney-film', 'https://www.disneyplus.com/cs-cz/browse/entity-1')?.yearExpected,
    ).toBe(true);
    expect(
      detect('ct-series', 'https://www.ceskatelevize.cz/porady/10111864738-hercule-poirot/')
        ?.yearExpected,
    ).toBe(false);
  });
});
