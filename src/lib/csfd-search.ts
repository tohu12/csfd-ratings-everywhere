import { decodeEntities } from './rating-parser';
import { normalizeTitle, type TitleKind } from './vod/detect';

/** What a VOD page tells us about a title (see `detectTitle`). */
export interface TitleQuery {
  titles: readonly string[];
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

// Works on strings: Chrome MV3 service workers have no DOMParser.
const ARTICLE = /<article\b/;
const TITLE_LINK = /<a\b([^>]*\bfilm-title-name\b[^>]*)>([^<]*)<\/a>/;
const FILM_HREF = /href="[^"]*\/film\/(\d+)[^"/]*\/(?:(\d+)[^"/]*\/)?"/;
const TITLE_INFO = /class="film-title-info">((?:\s*<span class="info">[^<]*<\/span>)*)/;
const INFO = /<span class="info">\(([^)]*)\)<\/span>/g;
const SEARCH_NAME = /<p class="search-name">\(([^)]*)\)<\/p>/;
const SERIES_INFO = new Set(['seriál', 'TV pořad']);
// Seasons and episodes are never what a VOD detail view shows.
const SKIPPED_INFO = new Set(['série', 'epizoda']);

/** Film and series results of a ČSFD search page, in page order. */
export function parseSearchPage(html: string): Candidate[] {
  return html.split(ARTICLE).slice(1).flatMap(parseArticle);
}

function parseArticle(chunk: string): Candidate[] {
  const link = TITLE_LINK.exec(chunk);
  const href = link && FILM_HREF.exec(String(link[1]));
  if (!link || !href) {
    return [];
  }
  const info = [...String(TITLE_INFO.exec(chunk)?.[1]).matchAll(INFO)].map((m) => String(m[1]));
  if (info.some((i) => SKIPPED_INFO.has(i))) {
    return [];
  }
  const year = info.find((i) => /^\d{4}$/.test(i));
  const original = SEARCH_NAME.exec(chunk)?.[1];
  return [
    {
      id: Number(href[2] ?? href[1]),
      titles: [link[2], original].flatMap((t) => (t ? [decodeEntities(t.trim())] : [])),
      year: year ? Number(year) : null,
      kind: info.some((i) => SERIES_INFO.has(i)) ? 'series' : 'film',
    },
  ];
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
