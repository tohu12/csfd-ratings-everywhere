import { createBackoff } from './backoff';
import {
  createLookupCache,
  createRatingCache,
  DEFAULT_LOOKUP_MAX_ENTRIES,
  DEFAULT_LOOKUP_TTL,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL,
  type LookupCache,
  type RatingCache,
} from './cache';
import { createHealth } from './health';
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
  /** Marks the toolbar icon while ČSFD pages can't be read (SPEC §6a). */
  showProblem: (broken: boolean) => void;
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
  const lookups = createLookupCache({
    store: deps.local,
    now: deps.now,
    maxEntries: DEFAULT_LOOKUP_MAX_ENTRIES,
    ttlMs: DEFAULT_LOOKUP_TTL,
  });
  const health = createHealth({ store: deps.local, onChange: deps.showProblem });
  // The icon badge does not survive a browser restart; the stored state does. The badge starts
  // empty, so a healthy start (most service-worker wakes) touches nothing.
  void health.broken().then(
    (pages) => pages.length > 0 && deps.showProblem(true),
    () => {},
  );
  const service = createRatingService({
    cache,
    lookups,
    health,
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
  return createMessageHandler({ service, caches: [cache, lookups], runtimeId: deps.runtimeId });
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
  caches,
  runtimeId,
}: {
  service: RatingService;
  /** Emptied by "Clear cache": ratings and title lookups. */
  caches: (RatingCache | LookupCache)[];
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
      case 'findTitle':
        return service.findTitle({
          titles: message.titles,
          year: message.year,
          kind: message.kind,
        });
      case 'clearCache':
        return Promise.all(caches.map((c) => c.clear())).then(() => true);
    }
  };
}
