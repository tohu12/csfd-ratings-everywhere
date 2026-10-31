import type { Backoff } from './backoff';
import type { RatingCache } from './cache';
import { ratingUrl } from './csfd-url';
import type { Limiter } from './queue';
import { BLOCKED, ERROR, type Rating } from './rating';
import { parseFilmPage } from './rating-parser';

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
}

export interface RatingServiceDeps {
  cache: RatingCache;
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

/** cache → backoff → limiter → fetch → parse, with in-flight de-duplication per id. */
export function createRatingService({
  cache,
  backoff,
  limiter,
  fetchPage,
}: RatingServiceDeps): RatingService {
  const inFlight = new Map<number, Promise<Rating>>();
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

  const fetchRating = async (id: number): Promise<Rating> => {
    // Re-checked here: the backoff may have tripped while this task waited in the queue.
    if (await backoff.isBlocked()) {
      return BLOCKED;
    }
    let response: PageResponse;
    try {
      response = await fetchPage(ratingUrl(id));
    } catch {
      return ERROR;
    }
    const rating = parseFilmPage(response.text);
    if (rating.status === 'blocked') {
      await slowDown(0);
      return rating;
    }
    if (THROTTLED.has(response.status)) {
      await slowDown(retryAfterMs(response.retryAfter));
      return BLOCKED;
    }
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

  return {
    peekRating: (id) => cache.get(id).catch(() => null),
    getRating(id) {
      const existing = inFlight.get(id);
      if (existing) {
        return existing;
      }
      const promise = load(id)
        .catch(() => ERROR)
        .finally(() => inFlight.delete(id));
      inFlight.set(id, promise);
      return promise;
    },
  };
}
