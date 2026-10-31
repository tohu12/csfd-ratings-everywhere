import { describe, expect, it } from 'vitest';
import {
  type Candidate,
  lookupKey,
  parseSearchPage,
  pickMatch,
  searchUrl,
} from '@/lib/csfd-search';
import { fixture } from '../helpers/fixtures';

const film = (id: number, titles: string[], year: number | null): Candidate => ({
  id,
  titles,
  year,
  kind: 'film',
});
const series = (id: number, titles: string[], year: number | null): Candidate => ({
  id,
  titles,
  year,
  kind: 'series',
});

describe('searchUrl', () => {
  it('survives a lone surrogate from a title cut in the middle of an emoji', () => {
    expect(searchUrl(`Film ${'😀'.slice(0, 1)}`)).toBe(
      'https://www.csfd.cz/hledat/?q=Film%20%EF%BF%BD',
    );
  });

  it('builds the ČSFD search URL with an encoded query', () => {
    expect(searchUrl('Špetka lásky & co')).toBe(
      'https://www.csfd.cz/hledat/?q=%C5%A0petka%20l%C3%A1sky%20%26%20co',
    );
  });
});

describe('pickMatch', () => {
  it('finds the one candidate whose title matches, ignoring case and diacritics', () => {
    const candidates = [film(1, ['Duna'], 2021), film(2, ['Dunaj'], 2021)];
    expect(pickMatch({ titles: ['DUNA'], year: 2021, kind: 'film' }, candidates)).toBe(1);
  });

  it('matches any query title against any candidate title (Czech or original)', () => {
    const candidates = [film(7, ['Nestvůra', 'The Beast Within'], 2024)];
    expect(
      pickMatch({ titles: ['Beast', 'The Beast Within'], year: 2024, kind: 'film' }, candidates),
    ).toBe(7);
  });

  it('accepts a film year off by one and rejects a larger gap', () => {
    expect(
      pickMatch({ titles: ['Duna'], year: 2022, kind: 'film' }, [film(1, ['Duna'], 2021)]),
    ).toBe(1);
    expect(
      pickMatch({ titles: ['Duna'], year: 2023, kind: 'film' }, [film(1, ['Duna'], 2021)]),
    ).toBe('notfound');
  });

  it('accepts a series that started before the year the VOD shows (latest season)', () => {
    const candidates = [series(3, ['Lupin'], 2021), film(4, ['Lupin'], 2026)];
    expect(pickMatch({ titles: ['Lupin'], year: 2026, kind: 'series' }, candidates)).toBe(3);
    expect(
      pickMatch({ titles: ['Lupin'], year: 2019, kind: 'series' }, [series(3, ['Lupin'], 2021)]),
    ).toBe('notfound');
  });

  it('prefers the exact year among several close candidates', () => {
    const candidates = [film(1, ['Duna'], 2021), film(2, ['Duna'], 2020)];
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, candidates)).toBe(1);
  });

  it('is ambiguous when several candidates fit equally well', () => {
    const remakes = [film(1, ['Duna'], 1984), film(2, ['Duna'], 2021)];
    expect(pickMatch({ titles: ['Duna'], year: null, kind: 'film' }, remakes)).toBe('ambiguous');
    const twins = [film(1, ['Duna'], 2021), film(2, ['Duna'], 2021)];
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, twins)).toBe('ambiguous');
    const close = [film(1, ['Duna'], 2020), film(2, ['Duna'], 2022)];
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, close)).toBe('ambiguous');
  });

  it('ignores the kind when either side does not know it', () => {
    const unknown: Candidate = { id: 9, titles: ['Duna'], year: 2021, kind: null };
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [unknown])).toBe(9);
    expect(
      pickMatch({ titles: ['Duna'], year: null, kind: null }, [series(5, ['Duna'], 2024)]),
    ).toBe(5);
  });

  it('never matches a dated query to a candidate without a year', () => {
    const undated: Candidate = { id: 9, titles: ['Duna'], year: null, kind: 'film' };
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [undated])).toBe('notfound');
  });

  it('is ambiguous without a VOD year even if one candidate has no year either', () => {
    const candidates = [film(1, ['Duna'], 1984), film(2, ['Duna'], null)];
    expect(pickMatch({ titles: ['Duna'], year: null, kind: 'film' }, candidates)).toBe('ambiguous');
  });

  it('is notfound without a title match', () => {
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [])).toBe('notfound');
    expect(
      pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [film(1, ['Dunaj'], 2021)]),
    ).toBe('notfound');
  });
});

describe('parseSearchPage', () => {
  it('reads films and series with year, kind and original names; skips seasons and users', () => {
    expect(parseSearchPage(fixture('csfd/search.html'))).toEqual([
      { id: 1234, titles: ['Duna', 'Dune'], year: 2021, kind: 'film' },
      { id: 2222, titles: ['Duna', 'Dune'], year: 1984, kind: 'film' },
      { id: 3333, titles: ['Duna: Část druhá', 'Dune: Part Two'], year: 2024, kind: 'film' },
      { id: 4444, titles: ['Tom & Jerry: Duna'], year: 2000, kind: 'film' },
      { id: 5555, titles: ['Duna: Proroctví', 'Dune: Prophecy'], year: 2024, kind: 'series' },
    ]);
  });

  it('picks the 2021 Duna from the fixture', () => {
    const candidates = parseSearchPage(fixture('csfd/search.html'));
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, candidates)).toBe(1234);
    expect(pickMatch({ titles: ['Dune'], year: null, kind: 'film' }, candidates)).toBe('ambiguous');
    expect(pickMatch({ titles: ['Dune: Prophecy'], year: 2024, kind: 'series' }, candidates)).toBe(
      5555,
    );
  });

  it('tolerates results without a year and pages without results', () => {
    const html =
      '<article><h3><a href="/film/9-x/" class="film-title-name">X</a>' +
      '<span class="film-title-info"><span class="info">(TV pořad)</span></span></h3></article>' +
      '<article><a class="film-title-name">no href</a></article>';
    expect(parseSearchPage(html)).toEqual([{ id: 9, titles: ['X'], year: null, kind: 'series' }]);
    expect(parseSearchPage('<html><p>Nic nenalezeno</p></html>')).toEqual([]);
  });

  it('labels TV films as films, unknown types as open, and drops invalid ids', () => {
    const article = (href: string, label: string) =>
      `<article><a href="${href}" class="film-title-name">X</a><span class="film-title-info">` +
      `<span class="info">(2020)</span>${label ? `<span class="info">(${label})</span>` : ''}</span></article>`;
    expect(
      parseSearchPage(
        article('/film/1-x/', 'TV film') +
          article('/film/2-x/', 'koncert') +
          article('/film/3-x/', 'TV seriál') +
          article('/film/0-x/', '') +
          article('/film/99999999999999999999-x/', ''),
      ).map((c) => [c.id, c.kind]),
    ).toEqual([
      [1, 'film'],
      [2, null],
      [3, 'series'],
    ]);
  });

  it('skips episodes', () => {
    const html =
      '<article><a href="/film/1-s/2-e/" class="film-title-name">Díl 1</a>' +
      '<span class="film-title-info"><span class="info">(epizoda)</span></span></article>';
    expect(parseSearchPage(html)).toEqual([]);
  });
});

describe('lookupKey', () => {
  it('normalises titles and keeps year and kind', () => {
    expect(lookupKey({ titles: ['Špetka lásky', 'Salted Love'], year: 2026, kind: 'series' })).toBe(
      'spetka lasky/salted love|2026|series',
    );
    expect(lookupKey({ titles: ['Duna'], year: null, kind: null })).toBe('duna||');
  });

  it('caps the title part of the key', () => {
    expect(
      lookupKey({ titles: ['a'.repeat(200), 'b'.repeat(200)], year: 2021, kind: 'film' }),
    ).toBe(`${'a'.repeat(120)}|2021|film`);
  });
});
