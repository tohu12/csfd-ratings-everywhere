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

// Bounds storage per lookup entry; NFD can make normalised text longer than the input.
const MAX_KEY_TITLES = 120;

/** Lookup cache key: the same query from any page shares one entry. */
export function lookupKey({ titles, year, kind }: TitleQuery): string {
  const names = titles.map(normalizeTitle).join('/').slice(0, MAX_KEY_TITLES);
  return [names, year ?? '', kind ?? ''].join('|');
}

/** Lone surrogates (a cut emoji) are replaced: `encodeURIComponent` would throw on them. */
export function searchUrl(title: string): string {
  return `https://www.csfd.cz/hledat/?q=${encodeURIComponent(title.toWellFormed())}`;
}

// Works on strings: Chrome MV3 service workers have no DOMParser.
const ARTICLE = /<article\b/;
const TITLE_LINK = /<a\b([^>]*\bfilm-title-name\b[^>]*)>([^<]*)<\/a>/;
// Real result links point to a tab: `/film/6250-duna/prehled/`, `/film/1/2-season-3/prehled/`.
const FILM_HREF = /href="[^"]*\/film\/(\d+)[^"/]*\/(?:(\d+)[^"/]*\/)?(?:[a-z-]+\/)?"/;
const TITLE_INFO = /class="film-title-info">((?:\s*<span class="info">[^<]*<\/span>)*)/;
const INFO = /<span class="info">\(([^)]*)\)<\/span>/g;
const SEARCH_NAME = /<p class="search-name">\(([^)]*)\)<\/p>/;
const SERIES_INFO = new Set(['seriál', 'TV seriál', 'TV pořad', 'minisérie']);
const FILM_INFO = new Set(['TV film', 'studentský film', 'amatérský film']);
// Seasons and episodes are never what a VOD detail view shows.
const SKIPPED_INFO = new Set(['série', 'epizoda']);

// On a search page only the results link films (checked on real pages, 2026-11-01).
const FILM_LINK = /href="[^"]*\/film\/\d/;
const TITLE_LINKS = new RegExp(TITLE_LINK.source, 'g');

/**
 * For the health signal (SPEC §6a): `results` when the page has result markup the parser knows
 * (seasons and episodes included, though `parseSearchPage` skips them), `empty` when it links no
 * film at all (an unknown title), `unreadable` when it links films in markup the parser no longer
 * recognises.
 */
export function searchPageState(html: string): 'results' | 'empty' | 'unreadable' {
  if ([...html.matchAll(TITLE_LINKS)].some((m) => FILM_HREF.test(String(m[1])))) {
    return 'results';
  }
  return FILM_LINK.test(html) ? 'unreadable' : 'empty';
}

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
  const id = Number(href[2] ?? href[1]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return [];
  }
  const year = info.find((i) => /^\d{4}$/.test(i));
  const original = SEARCH_NAME.exec(chunk)?.[1];
  return [
    {
      id,
      titles: [link[2], original].flatMap((t) => (t ? [decodeEntities(t.trim())] : [])),
      year: year ? Number(year) : null,
      kind: kindOf(info.filter((i) => i !== year)),
    },
  ];
}

/** No type label means a feature film; an unknown label is left open rather than guessed. */
function kindOf(labels: string[]): TitleKind | null {
  if (labels.some((l) => SERIES_INFO.has(l))) {
    return 'series';
  }
  return labels.every((l) => FILM_INFO.has(l)) ? 'film' : null;
}

/**
 * The single candidate that is certainly the queried title, or why there is none.
 * Without a year on the VOD side, only a title with a single ČSFD entry of that name matches.
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
  const exact =
    fits.length > 1 && query.year !== null ? fits.filter((c) => c.year === query.year) : fits;
  const [only, ...rest] = exact;
  if (only && rest.length === 0) {
    return only.id;
  }
  return fits.length === 0 ? 'notfound' : 'ambiguous';
}

function kindFits(wanted: TitleKind | null, actual: TitleKind | null): boolean {
  return wanted === null || actual === null || wanted === actual;
}

/** A candidate without a year never fits a dated query: it could be any film of that name. */
function yearFits(query: TitleQuery, year: number | null): boolean {
  if (query.year === null) {
    return true;
  }
  if (year === null) {
    return false;
  }
  return query.kind === 'series' ? year <= query.year : Math.abs(year - query.year) <= 1;
}
