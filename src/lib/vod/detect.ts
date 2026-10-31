import { isRecord } from '../rating';

export type TitleKind = 'film' | 'series';

/** A film or series shown on a VOD detail view. */
export interface DetectedTitle {
  /** Distinct names, best first: the on-page (usually Czech) title, then the document title. */
  titles: [string, ...string[]];
  year: number | null;
  kind: TitleKind | null;
  /** Where the badge goes; null when nothing suitable is on the page. */
  anchor: Element | null;
}

/**
 * Per-site hints. Sites without a `title` hint use the generic detector: an `img[alt]`/`h1–h3`
 * that the document title starts with (or the JSON-LD name), year and kind from the text near it.
 */
export interface VodSite {
  /** Hostname, matched with its subdomains. */
  host: string;
  /** Brand stripped from `document.title`. */
  brand: string;
  /** Only these path prefixes are detail pages (sites that also host news etc.). */
  paths?: readonly string[];
  /** Detail-view container; when set and absent, no title is shown. */
  root?: string;
  /** Element carrying the on-page title (text, or `alt` of an image). */
  title?: string;
  /** Element carrying the release year. */
  year?: string;
  /** Metadata row (year, duration, season count). Default: the year element's parent. */
  meta?: string;
  /** Present only on series. */
  series?: string;
  /** Element the badge is inserted after. */
  anchor?: string;
}

// Selectors captured 2026-10-31 from logged-in cs-CZ sessions (tests/fixtures/pages/vod/).
export const VOD_SITES: readonly VodSite[] = [
  {
    host: 'netflix.com',
    brand: 'Netflix',
    // The full detail modal; the hover mini-modal on tiles is `.mini-modal` and is ignored.
    root: '.previewModal--wrapper.detail-modal',
    title: '.about-header strong',
    year: '.videoMetadata--container .year',
    meta: '.videoMetadata--container',
    series: '[data-uia="episode-selector"]',
    anchor: '.videoMetadata--container .year',
  },
  {
    host: 'disneyplus.com',
    brand: 'Disney+',
    root: '[data-testid="explore-details-view"]',
    title: '[data-testid="details-title-treatment"] img[alt]',
    meta: '[data-testid="masthead-metadata"]',
    anchor: '[data-testid="masthead-metadata"]',
  },
  {
    host: 'hbomax.com',
    brand: 'HBO Max',
    root: '[data-testid="details-hero-container"]',
    // The hero image carries the localized title; rating and descriptor icons have a test id.
    title: 'img[alt]:not([data-testid])',
    year: '[data-testid="metadata_release_year"]',
    anchor: '[data-testid="metadata_release_year"]',
  },
  // Generic detection; pages captured logged out on 2026-10-31.
  { host: 'tv.apple.com', brand: 'Apple TV' },
  { host: 'primevideo.com', brand: 'Prime Video' },
  { host: 'skyshowtime.com', brand: 'SkyShowtime' },
  { host: 'oneplay.cz', brand: 'Oneplay' },
  { host: 'ceskatelevize.cz', brand: 'Česká televize', paths: ['/porady/', '/ivysilani/'] },
  { host: 'iprima.cz', brand: 'prima+', paths: ['/filmy/', '/serialy/'] },
];

export function findSite(hostname: string): VodSite | null {
  const host = hostname.toLowerCase();
  return VOD_SITES.find((s) => host === s.host || host.endsWith(`.${s.host}`)) ?? null;
}

// Format characters: LRM/RLM and the bidi isolates HBO Max and Apple TV wrap titles in.
const INVISIBLE = /\p{Cf}/gu;
const SEPARATOR = /(\s+[–|•·-]\s+)/;
const WATCH = /^(?:watch|sledujte|sledovat)\s+/i;

/** Lower case, no diacritics, punctuation or invisible marks, single spaces. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The film name from `document.title`: brand, "Watch …" and invisible marks removed. */
export function cleanDocumentTitle(raw: string, brand: string): string | null {
  const brandKey = normalizeTitle(brand);
  const isBrand = (piece: string) => normalizeTitle(piece).includes(brandKey);
  let text = raw.replace(INVISIBLE, '').trim();
  const colon = text.indexOf(':');
  if (colon > 0 && normalizeTitle(text.slice(0, colon)) === brandKey) {
    text = text.slice(colon + 1); // "Prime Video: Road House (2024)"
  }
  // Splitting with a capture group keeps the separators: [part, sep, part, sep, part].
  let pieces = text.trim().split(SEPARATOR);
  if (pieces.length > 1 && pieces.slice(-1).some(isBrand)) {
    pieces = pieces.slice(0, -2);
  }
  if (pieces.length > 1 && pieces.slice(0, 1).some(isBrand)) {
    pieces = pieces.slice(2);
  }
  const title = pieces.join('').replace(WATCH, '').trim();
  return title && normalizeTitle(title) !== brandKey ? title : null;
}

// `\b` is ASCII-only: it would end "2 séri" inside "2 sériích". END is a Unicode word end.
const END = '(?![\\p{L}\\p{N}])';
// Counts have 1–3 digits and must not start inside a longer number (linear on long digit runs).
const COUNT = '(?<!\\d)\\d{1,3}\\s*';
const YEAR = '((?:19|20)\\d{2})';
const DURATION = `${COUNT}(?:h|hod|hodin[ay]?|min|m)${END}`;
const SEASONS = `${COUNT}(?:řad[ay]?|séri[eí]|sezón[ay]?|seasons?|část[ií]?|dílů|episodes?)${END}`;
const YEAR_BEFORE = new RegExp(`(?<!\\d)${YEAR}\\s*[•·|,]?\\s*(?:${DURATION}|${SEASONS})`, 'iu');
const YEAR_AFTER = new RegExp(
  `${DURATION}(?:\\s*\\d{1,2}\\s*m${END})?\\s*[•·|,]?\\s*${YEAR}(?!\\d)`,
  'iu',
);
const YEAR_LABEL = new RegExp(`\\b(?:rok|year)\\s*:\\s*${YEAR}(?!\\d)`, 'iu');
const SERIES_WORDS = new RegExp(`${SEASONS}|\\bminis[ée]ri[ea]${END}|\\bmini-?series${END}`, 'iu');
const FILM_DURATION = new RegExp(DURATION, 'iu');
const SERIES_PATH = /\/(?:shows?|series|serials?|serialy|tv-shows?|tv)\//i;
const FILM_PATH = /\/(?:movies?|films?|filmy)\//i;
const YEAR_IN_PARENS = /\s*\(((?:19|20)\d{2})\)\s*$/;
const LD_KINDS: Record<string, TitleKind> = {
  Movie: 'film',
  TVSeries: 'series',
  TVSeason: 'series',
  TVEpisode: 'series',
  CreativeWorkSeason: 'series',
};
const LD_MAX_LENGTH = 100_000;
const NEAR_TITLE_LEVELS = 6;
const TEXT_LIMIT = 10_000;
const NOT_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** Finds the film or series of the open detail view, or null when there is none. */
export function detectTitle(doc: Document, url: URL, site: VodSite): DetectedTitle | null {
  if (site.paths && !site.paths.some((path) => url.pathname.startsWith(path))) {
    return null;
  }
  const root = site.root ? doc.querySelector(site.root) : doc.body;
  if (!root) {
    return null;
  }
  return site.title ? detectHinted(doc, url, site, root) : detectGeneric(doc, url, site, root);
}

function detectHinted(doc: Document, url: URL, site: VodSite, root: Element): DetectedTitle | null {
  const docTitle = cleanDocumentTitle(doc.title, site.brand);
  const titleEl = root.querySelector(String(site.title));
  const pageTitle = titleEl && elementText(titleEl);
  if (!pageTitle) {
    return null;
  }
  const yearEl = site.year ? root.querySelector(site.year) : null;
  const text = metadataText(root, site, yearEl);
  return {
    titles:
      docTitle && normalizeTitle(docTitle) !== normalizeTitle(pageTitle)
        ? [pageTitle, docTitle]
        : [pageTitle],
    year: site.year ? yearIn(yearEl) : yearFromText(text),
    kind:
      site.series && root.querySelector(site.series) ? 'series' : (pathKind(url) ?? textKind(text)),
    anchor: (site.anchor && root.querySelector(site.anchor)) || titleEl,
  };
}

/**
 * Text of the metadata row only: a synopsis or "more like this" list can mention "2 série" for a
 * film.
 */
function metadataText(root: Element, site: VodSite, yearEl: Element | null): string {
  const meta = site.meta ? root.querySelector(site.meta) : yearEl?.parentElement;
  return meta ? visibleText(meta) : '';
}

/**
 * Generic detection. The title is an on-page heading or image the document title starts with
 * (marketing suffixes like "– celý film online" then do not matter), or the JSON-LD name.
 * Year and kind come from the nearest ancestor text that has any, then from stronger signals.
 */
function detectGeneric(
  doc: Document,
  url: URL,
  site: VodSite,
  root: Element,
): DetectedTitle | null {
  const docTitle = cleanDocumentTitle(doc.title, site.brand);
  const ld = jsonLdTitle(doc);
  const titleEl = findTitleElement(root, docTitle, ld?.name ?? null);
  const pageTitle = titleEl ? elementText(titleEl) : ldTitleInDocumentTitle(ld, docTitle);
  if (!pageTitle) {
    return null;
  }
  const text = titleEl ? textNearTitle(titleEl) : '';
  const year = yearFromText(text) ?? yearInParens(doc.title);
  const kind =
    pathKind(url) ??
    (ld && sameTitle(ld.name, pageTitle) ? ld.kind : null) ??
    ogKind(doc, pageTitle) ??
    textKind(text);
  if (year === null && kind === null) {
    return null; // e.g. a category page whose heading matches its title
  }
  return { titles: [pageTitle], year, kind, anchor: titleEl };
}

/**
 * Best on-page title element: an exact JSON-LD name beats a document-title prefix, and a heading
 * beats an image (posters repeat the title in `alt`; a badge reads better after a heading).
 */
function findTitleElement(
  root: Element,
  docTitle: string | null,
  ldName: string | null,
): Element | null {
  const ldKey = ldName && normalizeTitle(ldName);
  const docKey = docTitle && normalizeTitle(docTitle);
  let best: Element | null = null;
  let bestScore = 0;
  for (const el of root.querySelectorAll('img[alt], h1, h2, h3')) {
    const score = titleMatch(normalizeTitle(elementText(el)), ldKey, docKey) * 2;
    const ranked = score && score + (el instanceof HTMLImageElement ? 0 : 1);
    if (ranked > bestScore) {
      best = el;
      bestScore = ranked;
    }
  }
  return best;
}

/** 2: the JSON-LD name; 1: the document title starts with it; 0: no match. */
function titleMatch(key: string, ldKey: string | null, docKey: string | null): number {
  if (!key) {
    return 0;
  }
  if (key === ldKey) {
    return 2;
  }
  return docKey && (docKey === key || docKey.startsWith(`${key} `)) ? 1 : 0;
}

function ldTitleInDocumentTitle(ld: LdTitle | null, docTitle: string | null): string | null {
  return ld && docTitle && normalizeTitle(docTitle).startsWith(normalizeTitle(ld.name))
    ? ld.name
    : null;
}

function sameTitle(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

/** Visible text, without a trailing "(2024)" that some sites append to the title. */
function elementText(el: Element): string {
  const text = el instanceof HTMLImageElement ? el.alt : String(el.textContent);
  return text.replace(INVISIBLE, '').replace(YEAR_IN_PARENS, '').trim();
}

/** Text of the nearest ancestor (up to NEAR_TITLE_LEVELS) that mentions a year, duration or seasons. */
function textNearTitle(titleEl: Element): string {
  let node = titleEl.parentElement;
  for (let level = 0; node && level < NEAR_TITLE_LEVELS; level++) {
    const text = visibleText(node);
    if (yearFromText(text) !== null || SERIES_WORDS.test(text) || FILM_DURATION.test(text)) {
      return text;
    }
    node = node.parentElement;
  }
  return '';
}

interface LdTitle {
  name: string;
  kind: TitleKind;
}

/** The first Movie/TVSeries item of the page's JSON-LD. Dates there are unreliable and unused. */
function jsonLdTitle(doc: Document): LdTitle | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const source = String(script.textContent);
    const items = source.length <= LD_MAX_LENGTH ? ldItems(safeJsonParse(source)) : [];
    for (const item of items) {
      const kind = isRecord(item) ? LD_KINDS[String(item['@type'])] : undefined;
      if (kind && isRecord(item) && typeof item['name'] === 'string' && item['name'].trim()) {
        return { name: item['name'].trim(), kind };
      }
    }
  }
  return null;
}

function ldItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return isRecord(value) && Array.isArray(value['@graph']) ? value['@graph'] : [value];
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** `og:type`, trusted only when `og:title` names the same title (SPAs can leave stale tags). */
function ogKind(doc: Document, pageTitle: string): TitleKind | null {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (!ogTitle || !normalizeTitle(ogTitle).includes(normalizeTitle(pageTitle))) {
    return null;
  }
  const type = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
  if (type === 'video.movie') {
    return 'film';
  }
  return type === 'video.tv_show' || type === 'video.episode' ? 'series' : null;
}

function yearInParens(title: string): number | null {
  const match = /\(((?:19|20)\d{2})\)/.exec(title);
  return match ? Number(match[1]) : null;
}

/**
 * Text nodes joined by spaces, so adjacent elements (`<div>2026</div><span>4 části</span>`) stay
 * apart. Script and style contents are skipped; the result is capped at TEXT_LIMIT characters.
 */
function visibleText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NOT_TEXT.has(node.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    },
  );
  let text = '';
  while (text.length < TEXT_LIMIT && walker.nextNode()) {
    text += ` ${String(walker.currentNode.nodeValue)}`;
  }
  return text.slice(0, TEXT_LIMIT).replace(INVISIBLE, '').replace(/\s+/g, ' ');
}

function yearIn(el: Element | null): number | null {
  const match = el && /\b(?:19|20)\d{2}\b/.exec(String(el.textContent));
  return match ? Number(match[0]) : null;
}

/** A year next to a duration or season count, or after a "Rok:" label; never a lone year. */
function yearFromText(text: string): number | null {
  const match = YEAR_LABEL.exec(text) ?? YEAR_BEFORE.exec(text) ?? YEAR_AFTER.exec(text);
  return match ? Number(match[1]) : null;
}

function pathKind(url: URL): TitleKind | null {
  if (SERIES_PATH.test(url.pathname)) {
    return 'series';
  }
  return FILM_PATH.test(url.pathname) ? 'film' : null;
}

/** Season count → series, duration → film; both or neither → unknown. */
function textKind(text: string): TitleKind | null {
  const seasons = SERIES_WORDS.test(text);
  const duration = FILM_DURATION.test(text);
  if (seasons === duration) {
    return null;
  }
  return seasons ? 'series' : 'film';
}
