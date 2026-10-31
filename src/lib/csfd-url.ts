/** A recognised ČSFD film link. `id` is the most specific id (episode > season > series). */
export interface CsfdLink {
  readonly id: number;
  readonly href: string;
}

export interface CsfdMatch extends CsfdLink {
  /** Offsets of the matched text within the searched string (end exclusive). */
  readonly start: number;
  readonly end: number;
}

const HOSTS = new Set(['csfd.cz', 'www.csfd.cz', 'm.csfd.cz', 'csfd.sk', 'www.csfd.sk']);

// Linear-time pieces: every quantifier is followed by a character it cannot consume.
const SLUG = String.raw`(?:-[^\s/?#<>"']*)?`;
const FILM_PATH = String.raw`(?:\/(?:sk|en))?\/film\/(\d+)${SLUG}(?:\/(\d+)${SLUG})*`;
const TEXT_URL = new RegExp(
  String.raw`(?<![\w.\-/@])(?:https?:\/\/)?(?:(?:www|m)\.)?csfd\.(?:cz|sk)${FILM_PATH}[^\s<>"']*`,
  'gi',
);
const PATH_ONLY = new RegExp(`^${FILM_PATH}`, 'i');
const TRAILING_PUNCTUATION = new Set('.,;:!?)]}>\'"');
const SCHEME = /^https?:\/\//i;
const QUICK_CHECK = /csfd\./i;

/** Cheap pre-filter: can this text contain a ČSFD URL at all? */
export function mightContainCsfd(text: string | null): boolean {
  return text !== null && QUICK_CHECK.test(text);
}

/** Finds all ČSFD film URLs written in plain text. */
export function findCsfdUrls(text: string): CsfdMatch[] {
  const matches: CsfdMatch[] = [];
  for (const m of text.matchAll(TEXT_URL)) {
    const raw = trimTrailingPunctuation(m[0]);
    const id = toId(m[2] ?? m[1]);
    if (id === null) {
      continue;
    }
    // Always https, whatever the page wrote.
    const href = `https://${raw.replace(SCHEME, '')}`;
    matches.push({ id, href, start: m.index, end: m.index + raw.length });
  }
  return matches;
}

/** Parses an absolute URL (e.g. an existing `<a href>`) into a ČSFD film link. */
export function parseCsfdUrl(url: string): CsfdLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || !HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  const m = PATH_ONLY.exec(parsed.pathname);
  const id = m ? toId(m[2] ?? m[1]) : null;
  return id === null ? null : { id, href: parsed.href };
}

/**
 * ČSFD's own sites (`csfd.cz`, `csfd.sk` and subdomains), where the content script is
 * excluded (`excludeMatches` in the content entrypoint) because ČSFD shows ratings itself.
 */
export function isCsfdHost(hostname: string): boolean {
  return /(^|\.)csfd\.(cz|sk)\.?$/i.test(hostname); // `\.?`: fully qualified `www.csfd.cz.`
}

/** The page the rating is read from. Always the canonical Czech host. */
export function ratingUrl(id: number): string {
  return `https://www.csfd.cz/film/${id}/prehled/`;
}

/** Linear-time right trim (a `[…]+$` regex would be quadratic on long punctuation runs). */
function trimTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(text.charAt(end - 1))) {
    end--;
  }
  return text.slice(0, end);
}

function toId(digits: string | undefined): number | null {
  const id = Number(digits);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
