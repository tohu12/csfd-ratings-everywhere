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
 * Per-site hints. Without hints the generic detector looks for an `img[alt]`/`h1–h3` whose text
 * equals the document title and reads year and kind from the surrounding text.
 */
export interface VodSite {
  /** Hostname, matched with its subdomains. */
  host: string;
  /** Brand stripped from `document.title`. */
  brand: string;
  /** Detail-view container; when set and absent, no title is shown. */
  root?: string;
  /** Element carrying the on-page title (text, or `alt` of an image). */
  title?: string;
  /** Element carrying the release year. */
  year?: string;
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
    series: '[data-uia="episode-selector"]',
    anchor: '.videoMetadata--container .year',
  },
  {
    host: 'disneyplus.com',
    brand: 'Disney+',
    root: '[data-testid="explore-details-view"]',
    title: '[data-testid="details-title-treatment"] img[alt]',
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
  { host: 'tv.apple.com', brand: 'Apple TV' },
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
  // Splitting with a capture group keeps the separators: [part, sep, part, sep, part].
  let pieces = raw.replace(INVISIBLE, '').trim().split(SEPARATOR);
  if (pieces.length > 1 && pieces.slice(-1).some(isBrand)) {
    pieces = pieces.slice(0, -2);
  }
  if (pieces.length > 1 && pieces.slice(0, 1).some(isBrand)) {
    pieces = pieces.slice(2);
  }
  const title = pieces.join('').replace(WATCH, '').trim();
  return title && normalizeTitle(title) !== brandKey ? title : null;
}

const YEAR = '((?:19|20)\\d{2})';
const DURATION = '\\d+\\s*(?:h|hod|hodin[ay]?|min|m)\\b';
const SEASONS = '\\d+\\s*(?:řad[ay]?|séri[eí]|sezón[ay]?|seasons?|část[ií]?|dílů|episodes?)\\b';
const YEAR_BEFORE = new RegExp(`\\b${YEAR}\\s*[•·|,]?\\s*(?:${DURATION}|${SEASONS})`, 'iu');
const YEAR_AFTER = new RegExp(`${DURATION}(?:\\s*\\d+\\s*m\\b)?\\s*[•·|,]?\\s*${YEAR}\\b`, 'iu');
const YEAR_LABEL = new RegExp(`\\b(?:rok|year)\\s*:\\s*${YEAR}\\b`, 'iu');
const SERIES_WORDS = new RegExp(`${SEASONS}|\\bminis[ée]ri[ea]\\b|\\bmini-?series\\b`, 'iu');
const FILM_DURATION = new RegExp(DURATION, 'iu');
const SERIES_PATH = /\/(?:show|series|serial|tv-show)s?\//i;
const FILM_PATH = /\/(?:movie|film)s?\//i;
const TEXT_NODE_LIMIT = 400;

/** Finds the film or series of the open detail view, or null when there is none. */
export function detectTitle(doc: Document, url: URL, site: VodSite): DetectedTitle | null {
  const root = site.root ? doc.querySelector(site.root) : doc.body;
  if (!root) {
    return null;
  }
  const docTitle = cleanDocumentTitle(doc.title, site.brand);
  const titleEl = site.title
    ? root.querySelector(site.title)
    : docTitle && findTitleElement(root, docTitle);
  const pageTitle = titleEl && elementText(titleEl);
  if (!pageTitle) {
    return null;
  }
  const text = visibleText(root);
  const year = site.year ? yearIn(root.querySelector(site.year)) : yearFromText(text);
  const kind = kindOf(root, url, site, text);
  if (!site.root && year === null && kind === null) {
    return null;
  }
  return {
    titles:
      docTitle && normalizeTitle(docTitle) !== normalizeTitle(pageTitle)
        ? [pageTitle, docTitle]
        : [pageTitle],
    year,
    kind,
    anchor: (site.anchor && root.querySelector(site.anchor)) || titleEl,
  };
}

function findTitleElement(root: Element, docTitle: string): Element | null {
  const key = normalizeTitle(docTitle);
  for (const el of root.querySelectorAll('img[alt], h1, h2, h3')) {
    if (normalizeTitle(elementText(el)) === key) {
      return el;
    }
  }
  return null;
}

function elementText(el: Element): string {
  const text = el instanceof HTMLImageElement ? el.alt : String(el.textContent);
  return text.replace(INVISIBLE, '').trim();
}

/** Text nodes joined by spaces, so adjacent elements (`<div>2026</div><span>4 části</span>`) stay apart. */
function visibleText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode() && parts.length < TEXT_NODE_LIMIT) {
    parts.push(String(walker.currentNode.nodeValue));
  }
  return parts.join(' ').replace(INVISIBLE, '').replace(/\s+/g, ' ');
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

function kindOf(root: Element, url: URL, site: VodSite, text: string): TitleKind | null {
  if (site.series && root.querySelector(site.series)) {
    return 'series';
  }
  if (SERIES_PATH.test(url.pathname)) {
    return 'series';
  }
  if (FILM_PATH.test(url.pathname)) {
    return 'film';
  }
  if (SERIES_WORDS.test(text)) {
    return 'series';
  }
  return FILM_DURATION.test(text) ? 'film' : null;
}
