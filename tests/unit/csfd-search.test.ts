import { describe, expect, it } from 'vitest';
import { type Candidate, pickMatch, searchUrl } from '@/lib/csfd-search';

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

  it('ignores the kind or year when either side does not know it', () => {
    const unknown: Candidate = { id: 9, titles: ['Duna'], year: null, kind: null };
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [unknown])).toBe(9);
    expect(
      pickMatch({ titles: ['Duna'], year: null, kind: null }, [series(5, ['Duna'], 2024)]),
    ).toBe(5);
  });

  it('is notfound without a title match', () => {
    expect(pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [])).toBe('notfound');
    expect(
      pickMatch({ titles: ['Duna'], year: 2021, kind: 'film' }, [film(1, ['Dunaj'], 2021)]),
    ).toBe('notfound');
  });
});
