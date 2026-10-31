import { BLOCKED, ERROR, isRecord, type Rating } from './rating';

// Works on strings: Chrome MV3 service workers have no DOMParser.
const ANUBIS = /id=["']anubis_(?:version|challenge)["']/;
const JSON_LD_OPEN = /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i;
const RATING_AVERAGE = /class="[^"]*\bfilm-rating-average\b[^"]*"[^>]*>\s*(?:(\d{1,3})\s*%)?/;
const H1 = /<h1[^>]*>\s*([^<]+?)\s*</;

/** Detects the Anubis bot-protection interstitial (challenge or reject page). */
export function isAnubisPage(html: string): boolean {
  return ANUBIS.test(html);
}

/**
 * Extracts the rating from a ČSFD film page.
 * Order: JSON-LD `aggregateRating` → `.film-rating-average` markup. A recognisable film page
 * without a rating yields `none`; anything unrecognisable yields `error`.
 */
export function parseFilmPage(html: string): Rating {
  if (isAnubisPage(html)) {
    return BLOCKED;
  }
  const ld = findJsonLdItem(html);
  const fromLd = ld ? ratingFromJsonLd(ld) : null;
  if (fromLd) {
    return fromLd;
  }
  const average = RATING_AVERAGE.exec(html);
  const title = ld ? titleFromJsonLd(ld) : titleFromH1(html);
  const percent = average?.[1];
  if (percent !== undefined) {
    return { status: 'ok', percent: clampPercent(Number(percent)), count: null, title };
  }
  return ld || average ? { status: 'none', title } : ERROR;
}

const FILM_TYPES = new Set(['Movie', 'TVSeries', 'TVSeason', 'TVEpisode', 'CreativeWorkSeason']);

/** The film item: one with `aggregateRating` wins; otherwise one with a film `@type`. */
function findJsonLdItem(html: string): Record<string, unknown> | null {
  const items = jsonLdBlocks(html)
    .flatMap((block) => jsonLdItems(safeJsonParse(block)))
    .filter(isRecord);
  return items.find((item) => 'aggregateRating' in item) ?? items.find(isFilmType) ?? null;
}

function isFilmType(item: Record<string, unknown>): boolean {
  const type = item['@type'];
  const types: unknown[] = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && FILM_TYPES.has(t));
}

function jsonLdBlocks(html: string): string[] {
  return html
    .split(JSON_LD_OPEN)
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf('</script>')));
}

function jsonLdItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value['@graph'])) {
    return value['@graph'];
  }
  return [value];
}

function ratingFromJsonLd(item: Record<string, unknown>): Rating | null {
  const agg = item['aggregateRating'];
  if (!isRecord(agg)) {
    return null;
  }
  const value = toNumber(agg['ratingValue']);
  const best = toNumber(agg['bestRating']) ?? 100;
  if (value === null || best <= 0) {
    return null;
  }
  const count = toNumber(agg['ratingCount']);
  return {
    status: 'ok',
    percent: clampPercent((value / best) * 100),
    count: count !== null && Number.isSafeInteger(count) && count >= 0 ? count : null,
    title: titleFromJsonLd(item),
  };
}

function titleFromJsonLd(item: Record<string, unknown>): string | null {
  return typeof item['name'] === 'string' ? decodeEntities(item['name']) : null;
}

function titleFromH1(html: string): string | null {
  const m = H1.exec(html);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Decodes the HTML entities ČSFD uses in titles. */
export function decodeEntities(text: string): string {
  // `&amp;` last, so `&amp;lt;` stays the literal text `&lt;`.
  return text
    .replace(/&#(\d+);/g, (whole, dec: string) => fromCodePoint(Number(dec), whole))
    .replace(/&#x([\da-f]+);/gi, (whole, hex: string) =>
      fromCodePoint(Number.parseInt(hex, 16), whole),
    )
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&amp;/gi, '&');
}

function fromCodePoint(code: number, fallback: string): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}
