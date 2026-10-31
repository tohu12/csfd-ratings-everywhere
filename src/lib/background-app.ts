import { createBackoff } from './backoff';
import { createRatingCache, DEFAULT_MAX_ENTRIES, DEFAULT_TTL, type RatingCache } from './cache';
import { isBackgroundRequest } from './messages';
import { createLimiter } from './queue';
import { createRatingService, type FetchPage, type RatingService } from './rating-service';
import type { MessageHandler } from './runtime-listener';
import type { Clock, KeyValueStore } from './store';

export interface BackgroundDeps {
  runtimeId: string;
  local: KeyValueStore;
  session: KeyValueStore;
  fetch: typeof globalThis.fetch;
  now: Clock;
  setTimer: (callback: () => void, ms: number) => unknown;
}

const MINUTE = 60 * 1000;

/** Wires the real background graph. Returned handler goes to `runtime.onMessage`. */
export function createBackgroundApp(deps: BackgroundDeps): MessageHandler {
  const cache = createRatingCache({
    store: deps.local,
    now: deps.now,
    maxEntries: DEFAULT_MAX_ENTRIES,
    ttlMs: DEFAULT_TTL,
  });
  const service = createRatingService({
    cache,
    backoff: createBackoff({
      store: deps.session,
      now: deps.now,
      baseMs: 10 * MINUTE,
      maxMs: 360 * MINUTE,
    }),
    limiter: createLimiter({
      concurrency: 2,
      minIntervalMs: 400,
      maxPending: 20,
      now: deps.now,
      setTimer: deps.setTimer,
    }),
    fetchPage: createFetchPage(deps.fetch),
  });
  return createMessageHandler({ service, cache, runtimeId: deps.runtimeId });
}

/** Plain browser request: default headers, the user's own cookies. Never spoofs anything. */
export function createFetchPage(fetchFn: typeof globalThis.fetch): FetchPage {
  return async (url) => {
    const response = await fetchFn(url, { credentials: 'include', redirect: 'follow' });
    return {
      status: response.status,
      text: await response.text(),
      retryAfter: response.headers.get('retry-after'),
    };
  };
}

export function createMessageHandler({
  service,
  cache,
  runtimeId,
}: {
  service: RatingService;
  cache: RatingCache;
  runtimeId: string;
}): MessageHandler {
  return (message, sender) => {
    // Only our own extension pages and content scripts; unknown messages stay unanswered.
    if (sender.id !== runtimeId || !isBackgroundRequest(message)) {
      return undefined;
    }
    switch (message.type) {
      case 'getRating':
        return service.getRating(message.id);
      case 'peekRating':
        return service.peekRating(message.id);
      case 'clearCache':
        return cache.clear().then(() => true);
    }
  };
}
