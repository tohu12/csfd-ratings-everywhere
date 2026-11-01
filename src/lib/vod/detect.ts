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
  /** The site shows a year for every title (per-site hints): a lookup waits until it renders. */
  yearExpected: boolean;
}

/**
 * Per-site hints. Sites without a `title` hint use the generic detector: the `h1–h3`/`img[alt]`
 * that best matches the document title (or its JSON-LD name), year and kind from the text near it.
 */
export interface VodSite {
  /** Hostname, matched with its subdomains. */
  host: string;
  /** Brand stripped from `document.title`. */
  brand: string;
  /** Pathname of a detail page; any other page (news, people, episodes, lists) is ignored. */
  detailPath?: RegExp;
  /** Path patterns the script is injected on (default `/*`): skips other regions of a global host. */
  paths?: readonly string[];
  /** Detail-view container; when set and absent, no title is shown. */
  root?: string;
  /** Element carrying the on-page title (text, or `alt` of an image). */
  title?: string;
  /**
   * Element carrying the original title, used as the second title instead of the document title
   * (which is marketing text on such sites). A leading "Label:" is removed.
   */
  altTitle?: string;
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
  { host: 'tv.apple.com', brand: 'Apple TV', detailPath: /\/(?:movie|show)\/[^/]+\/[^/]+\/?$/ },
  { host: 'primevideo.com', brand: 'Prime Video', detailPath: /\/detail\/[^/]+/ },
  {
    host: 'skyshowtime.com',
    brand: 'SkyShowtime',
    detailPath: /\/stream\/(?:movies|tv)\/[^/]+\/[^/]+\/?$/,
  },
  { host: 'oneplay.cz', brand: 'Oneplay', detailPath: /^\/porad\/\d+-[^/]+\/?$/ },
  { host: 'ceskatelevize.cz', brand: 'Česká televize', detailPath: /^\/porady\/\d+-[^/]+\/?$/ },
  { host: 'iprima.cz', brand: 'prima+', detailPath: /^\/(?:filmy|serialy)\/[^/]+\/?$/ },
  // Generic detection; pages captured logged out on 2026-11-01 (tools/capture-vod-page.mjs).
  // Detail pages redirect to /titul/; episodes live under /serialy/<id>/epizoda/.
  {
    host: 'voyo.markiza.sk',
    brand: 'Voyo',
    detailPath: /^\/(?:titul|filmy|serialy|relacie)\/\d+-[^/]+\/?$/,
  },
  // A global host: only the Czech and Slovak catalogues are injected and detected.
  {
    host: 'canalplus.com',
    brand: 'CANAL+',
    paths: ['/cz/*', '/sk/*'],
    detailPath: /^\/(?:cz|sk)\/[a-z]{2}\/(?:filmy|serialy)\/[^/]+\/h\/[^/]+\/?$/,
  },
  // The detail is a modal over the catalogue (`/cz?content_id=…`): no path to filter on.
  { host: 'rakuten.tv', brand: 'Rakuten TV' },
  { host: 'mubi.com', brand: 'MUBI', detailPath: /^\/[a-z]{2}(?:\/[a-z]{2})?\/films\/[^/]+\/?$/ },
  { host: 'kviff.tv', brand: 'KVIFF.TV', detailPath: /^\/videos\/[^/]+\/?$/ },
  // An aggregator, not a VOD (owner, 2026-11-01). Its document title is marketing text and its
  // page has "Sledování titulu …" headings, so it needs hints.
  {
    host: 'justwatch.com',
    brand: 'JustWatch',
    paths: ['/cz/*', '/sk/*'],
    detailPath: /^\/(?:cz|sk)\/(?:film|serial)\/[^/]+\/?$/,
    root: '.title-detail-hero',
    title: 'h1.title-detail-hero__details__title',
    altTitle: '.original-title',
    year: '.release-year',
    meta: '.title-detail-hero__details',
    anchor: '.release-year',
  },
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
  // Whole words only: "Primadonky" is not the brand "prima+".
  const isBrand = (piece: string) => ` ${normalizeTitle(piece)} `.includes(` ${brandKey} `);
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
// Also "48 - 53m" (episode lengths, Voyo) and "2h52" (Canal+).
const DURATION = `${COUNT}(?:[-–]\\s*\\d{1,3}\\s*)?(?:h\\d{1,2}(?:min|m)?|h|hod|hodin[ay]?|min|minut[ay]?|minutes?|m)${END}`;
const SEASONS = `${COUNT}(?:řad[ay]?|séri[aeií]|sezón[ay]?|seasons?|část[ií]?|dílů|episodes?)${END}`;
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
const ANY_YEAR_IN_PARENS = /\((?:19|20)\d{2}\)/g;
const LD_KINDS: Record<string, TitleKind> = { Movie: 'film', TVSeries: 'series' };
// Their `name` is an episode or season name, never what ČSFD should be searched for.
const LD_PARTS = new Set(['TVEpisode', 'TVSeason', 'CreativeWorkSeason']);
const LD_MAX_LENGTH = 100_000;
const NEAR_TITLE_LEVELS = 6;
const TEXT_LIMIT = 10_000;
const NOT_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** Finds the film or series of the open detail view, or null when there is none. */
export function detectTitle(doc: Document, url: URL, site: VodSite): DetectedTitle | null {
  if (site.detailPath && !site.detailPath.test(url.pathname)) {
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
  const second = site.altTitle ? labelledText(root.querySelector(site.altTitle)) : docTitle;
  return {
    titles:
      second && normalizeTitle(second) !== normalizeTitle(pageTitle)
        ? [pageTitle, second]
        : [pageTitle],
    year: site.year ? yearIn(yearEl) : yearFromText(text),
    kind:
      site.series && root.querySelector(site.series) ? 'series' : (pathKind(url) ?? textKind(text)),
    anchor: (site.anchor && root.querySelector(site.anchor)) || titleEl,
    yearExpected: Boolean(site.year ?? site.meta),
  };
}

/** "Původní název: The Office" → "The Office". */
function labelledText(el: Element | null): string | null {
  return el && elementText(el).replace(/^[^:]{1,30}:\s*/, '');
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
 * Generic detection. The title is the on-page heading or image that best matches the document
 * title (marketing suffixes like "– celý film online" do not matter) or its JSON-LD name.
 * Year and kind come from the nearest text around it; the URL can refine the kind but never
 * makes a page a detail page on its own.
 */
function detectGeneric(
  doc: Document,
  url: URL,
  site: VodSite,
  root: Element,
): DetectedTitle | null {
  const docKey = documentKey(doc, site);
  if (!docKey) {
    return null; // a brand-only title (catalogue, home): nothing can match, skip the DOM scan
  }
  const ld = jsonLdTitle(doc);
  if (ld === 'part') {
    return null; // an episode or season page
  }
  // JSON-LD can be stale after client-side navigation: trust it only if the title agrees.
  const trusted = ld && startsWithWords(docKey, normalizeTitle(ld.name)) ? ld : null;
  const titleEl = findTitleElement(root, docKey, trusted ? normalizeTitle(trusted.name) : '');
  const pageTitle = titleEl ? elementText(titleEl) : trusted?.name;
  if (!pageTitle) {
    return null;
  }
  const text = titleEl ? textNearTitle(titleEl) : '';
  const year = yearFromText(text) ?? yearInParens(doc.title);
  const contentKind =
    (trusted && sameTitle(trusted.name, pageTitle) ? trusted.kind : null) ??
    ogKind(doc, site, pageTitle) ??
    textKind(text);
  if (year === null && contentKind === null) {
    return null; // e.g. a category page whose heading matches its title
  }
  return {
    titles: [pageTitle],
    year,
    kind: pathKind(url) ?? contentKind,
    anchor: titleEl,
    yearExpected: false,
  };
}

/** The normalised document title without "(2024)"; empty when only the brand is left. */
function documentKey(doc: Document, site: VodSite): string {
  const docTitle = cleanDocumentTitle(doc.title, site.brand);
  return docTitle ? normalizeTitle(docTitle.replace(ANY_YEAR_IN_PARENS, ' ')) : '';
}

/**
 * Best on-page title element, ranked by match quality: the JSON-LD name, then the whole document
 * title, then the longest prefix of it. On a tie, headings and images inside headings win
 * (posters and backdrops repeat the title in `alt`). Elements inside links are tiles of other
 * titles and never count.
 */
function findTitleElement(root: Element, docKey: string, ldKey: string): Element | null {
  let best: Element | null = null;
  let bestRank = 0;
  for (const el of root.querySelectorAll('img[alt], h1, h2, h3')) {
    const key = el.closest('a[href]') ? '' : normalizeTitle(elementText(el));
    const tier = titleTier(key, ldKey, docKey);
    // On a tie a heading (or a logo inside one) beats a loose image such as a hero backdrop.
    const rank =
      tier && tier * 100_000 + Math.min(key.length, 9_999) * 2 + (el.closest('h1, h2, h3') ? 1 : 0);
    if (rank > bestRank) {
      best = el;
      bestRank = rank;
    }
  }
  return best;
}

/** 3: the JSON-LD name; 2: the whole document title; 1: a prefix of it; 0: no match. */
function titleTier(key: string, ldKey: string, docKey: string): number {
  if (!key) {
    return 0;
  }
  if (key === ldKey) {
    return 3;
  }
  if (key === docKey) {
    return 2;
  }
  return startsWithWords(docKey, key) ? 1 : 0;
}

/** `text` starts with the whole words of `prefix`. */
function startsWithWords(text: string, prefix: string): boolean {
  return prefix !== '' && (text === prefix || text.startsWith(`${prefix} `));
}

function sameTitle(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

/** Visible text, without a trailing "(2024)" that some sites append to the title. */
function elementText(el: Element): string {
  const text = el instanceof HTMLImageElement ? el.alt : String(el.textContent);
  return text.replace(INVISIBLE, '').replace(YEAR_IN_PARENS, '').trim();
}

/**
 * Text of the nearest ancestor (up to NEAR_TITLE_LEVELS) that mentions a year, duration or
 * seasons. The walk stops at a container holding another heading: rows of other titles.
 */
function textNearTitle(titleEl: Element): string {
  const own = titleEl.closest('h1, h2, h3');
  // Count levels from the heading: logos sit a few wrappers deep inside it.
  let node = (own ?? titleEl).parentElement;
  for (let level = 0; node && level < NEAR_TITLE_LEVELS; level++) {
    if ([...node.querySelectorAll('h1, h2, h3')].some((heading) => heading !== own)) {
      return '';
    }
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

/**
 * The first top-level Movie/TVSeries item of the page's JSON-LD, or `part` for an episode or
 * season page. Dates there are unreliable (often broadcast dates) and unused.
 */
function jsonLdTitle(doc: Document): LdTitle | 'part' | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const source = String(script.textContent);
    const items = source.length <= LD_MAX_LENGTH ? ldItems(safeJsonParse(source)) : [];
    for (const item of items.filter(isRecord)) {
      const type = String(item['@type']);
      if (LD_PARTS.has(type)) {
        return 'part';
      }
      const kind = LD_KINDS[type];
      const name = typeof item['name'] === 'string' ? item['name'].trim() : '';
      if (kind && name) {
        return { name, kind };
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

/** `og:type`, trusted only when `og:title` starts with the title (SPAs can leave stale tags). */
function ogKind(doc: Document, site: VodSite, pageTitle: string): TitleKind | null {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const ogKey = normalizeTitle(cleanDocumentTitle(ogTitle ?? '', site.brand) ?? '');
  if (!startsWithWords(ogKey, normalizeTitle(pageTitle))) {
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
