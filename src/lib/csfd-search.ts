import { normalizeTitle, type TitleKind } from './vod/detect';

/** What a VOD page tells us about a title (see `detectTitle`). */
export interface TitleQuery {
  titles: string[];
  year: number | null;
  kind: TitleKind | null;
}

/** One ČSFD search result. */
export interface Candidate {
  id: number;
  /** Czech name first, then original and other names. */
  titles: string[];
  year: number | null;
  kind: TitleKind | null;
}

export type Match = number | 'ambiguous' | 'notfound';

export function searchUrl(title: string): string {
  return `https://www.csfd.cz/hledat/?q=${encodeURIComponent(title)}`;
}

/**
 * The single candidate that is certainly the queried title, or why there is none.
 * Titles must match exactly after normalisation. A film's year may be off by one (premiere vs
 * release). VOD services show a series' latest season year, so a series may have started earlier.
 */
export function pickMatch(query: TitleQuery, candidates: Candidate[]): Match {
  const keys = new Set(query.titles.map(normalizeTitle));
  const fits = candidates.filter(
    (c) =>
      c.titles.some((t) => keys.has(normalizeTitle(t))) &&
      kindFits(query.kind, c.kind) &&
      yearFits(query, c.year),
  );
  const exact = fits.length > 1 ? fits.filter((c) => c.year === query.year) : fits;
  const [only, ...rest] = exact;
  if (only && rest.length === 0) {
    return only.id;
  }
  return fits.length === 0 ? 'notfound' : 'ambiguous';
}

function kindFits(wanted: TitleKind | null, actual: TitleKind | null): boolean {
  return wanted === null || actual === null || wanted === actual;
}

function yearFits(query: TitleQuery, year: number | null): boolean {
  if (query.year === null || year === null) {
    return true;
  }
  return query.kind === 'series' ? year <= query.year : Math.abs(year - query.year) <= 1;
}
