import type { Backoff } from './backoff';
import type { LookupCache, RatingCache } from './cache';
import { type Match, parseSearchPage, pickMatch, searchUrl, type TitleQuery } from './csfd-search';
import { ratingUrl } from './csfd-url';
import type { TitleResult } from './messages';
import type { Limiter } from './queue';
import { BLOCKED, ERROR, type Rating } from './rating';
import { isAnubisPage, parseFilmPage } from './rating-parser';
import { normalizeTitle } from './vod/detect';

export interface PageResponse {
  status: number;
  text: string;
  /** Raw `Retry-After` header, if any. */
  retryAfter: string | null;
}

export type FetchPage = (url: string) => Promise<PageResponse>;

export interface RatingService {
  /** Cache first, then the network (rate-limited, backoff-aware). */
  getRating(id: number): Promise<Rating>;
  /** Cache only; never touches the network. */
  peekRating(id: number): Promise<Rating | null>;
  /** A VOD title → its ČSFD id (lookup cache, then search) → its rating. */
  findTitle(query: TitleQuery): Promise<TitleResult>;
}

export interface RatingServiceDeps {
  cache: RatingCache;
  lookups: LookupCache;
  backoff: Backoff;
  limiter: Limiter;
  fetchPage: FetchPage;
}

const THROTTLED = new Set([429, 503]);
const GONE = new Set([404, 410]);

async function settle(...promises: Promise<unknown>[]): Promise<void> {
  await Promise.allSettled(promises);
}

/** `Retry-After` in seconds or as an HTTP date → milliseconds (0 when absent or invalid). */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (header === null) {
    return 0;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  return Number.isNaN(date) ? 0 : Math.max(0, date - now);
}

/** Lookup cache key: the same query from any page shares one entry. */
export function lookupKey({ titles, year, kind }: TitleQuery): string {
  return [titles.map(normalizeTitle).join('/'), year ?? '', kind ?? ''].join('|');
}

/** cache → backoff → limiter → fetch → parse, with in-flight de-duplication per id. */
export function createRatingService({
  cache,
  lookups,
  backoff,
  limiter,
  fetchPage,
}: RatingServiceDeps): RatingService {
  const inFlight = new Map<number, Promise<Rating>>();
  const titlesInFlight = new Map<string, Promise<TitleResult>>();
  let pendingTrip: Promise<void> | null = null;

  const tripIfOpen = async (minPauseMs: number): Promise<void> => {
    if (!(await backoff.isBlocked())) {
      await backoff.trip(minPauseMs);
    }
  };

  // Coalesce concurrent "slow down" answers into a single backoff step.
  const slowDown = async (minPauseMs: number): Promise<void> => {
    pendingTrip ??= tripIfOpen(minPauseMs).finally(() => {
      pendingTrip = null;
    });
    await pendingTrip;
  };

  /** One csfd.cz request that honours and feeds the backoff. */
  const request = async (url: string): Promise<PageResponse | 'blocked' | 'error'> => {
    // Re-checked here: the backoff may have tripped while this task waited in the queue.
    if (await backoff.isBlocked()) {
      return 'blocked';
    }
    let response: PageResponse;
    try {
      response = await fetchPage(url);
    } catch {
      return 'error';
    }
    if (isAnubisPage(response.text)) {
      await slowDown(0);
      return 'blocked';
    }
    if (THROTTLED.has(response.status)) {
      await slowDown(retryAfterMs(response.retryAfter));
      return 'blocked';
    }
    return response;
  };

  const fetchRating = async (id: number): Promise<Rating> => {
    const response = await request(ratingUrl(id));
    if (response === 'blocked') {
      return BLOCKED;
    }
    if (response === 'error') {
      return ERROR;
    }
    const rating = parseFilmPage(response.text);
    if (GONE.has(response.status)) {
      await settle(cache.set(id, ERROR)); // the film does not exist; don't ask again for a day
      return ERROR;
    }
    if (response.status < 200 || response.status >= 300) {
      return ERROR;
    }
    // Storage hiccups must not turn a good answer into an error.
    await settle(backoff.reset(), cache.set(id, rating));
    return rating;
  };

  const load = async (id: number): Promise<Rating> => {
    const cached = await cache.get(id);
    if (cached) {
      return cached;
    }
    if (await backoff.isBlocked()) {
      return BLOCKED;
    }
    return limiter(() => fetchRating(id));
  };

  const getRating = (id: number): Promise<Rating> => {
    const existing = inFlight.get(id);
    if (existing) {
      return existing;
    }
    const promise = load(id)
      .catch(() => ERROR)
      .finally(() => inFlight.delete(id));
    inFlight.set(id, promise);
    return promise;
  };

  /** Searches the on-page title first, the document title only when that finds nothing. */
  const search = async (query: TitleQuery): Promise<Match | 'blocked' | 'error'> => {
    for (const title of query.titles) {
      if (await backoff.isBlocked()) {
        return 'blocked';
      }
      const response = await limiter(() => request(searchUrl(title)));
      if (typeof response === 'string') {
        return response;
      }
      if (response.status < 200 || response.status >= 300) {
        return 'error';
      }
      await settle(backoff.reset());
      const match = pickMatch(query, parseSearchPage(response.text));
      if (match !== 'notfound') {
        return match;
      }
    }
    return 'notfound';
  };

  const lookUp = async (query: TitleQuery): Promise<TitleResult> => {
    const key = lookupKey(query);
    let match = await lookups.get(key).catch(() => null);
    if (match === null) {
      const found = await search(query);
      if (found === 'blocked' || found === 'error') {
        return { status: found };
      }
      match = found;
      await settle(lookups.set(key, match));
    }
    return typeof match === 'number'
      ? { status: 'found', id: match, rating: await getRating(match) }
      : { status: 'unsure' };
  };

  return {
    peekRating: (id) => cache.get(id).catch(() => null),
    getRating,
    findTitle(query) {
      const key = lookupKey(query);
      const existing = titlesInFlight.get(key);
      if (existing) {
        return existing;
      }
      const promise = lookUp(query)
        .catch((): TitleResult => ({ status: 'error' }))
        .finally(() => titlesInFlight.delete(key));
      titlesInFlight.set(key, promise);
      return promise;
    },
  };
}
