import { isRating, isRecord, type Rating } from './rating';
import type { Clock, KeyValueStore } from './store';

export interface RatingCache {
  get(id: number): Promise<Rating | null>;
  set(id: number, rating: Rating): Promise<void>;
  clear(): Promise<void>;
}

export interface RatingCacheOptions {
  store: KeyValueStore;
  now: Clock;
  maxEntries: number;
  ttlMs: { ok: number; none: number; error: number };
}

const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_TTL = { ok: 7 * DAY, none: DAY, error: DAY } as const;
export const DEFAULT_MAX_ENTRIES = 2000;

const INDEX_KEY = 'ratings:index';
const entryKey = (id: number) => `rating:${id}`;

interface Entry {
  rating: Rating;
  expires: number;
}

/**
 * Rating cache over `storage.local`. `blocked` is never cached; callers decide which errors to cache.
 * Entry count is bounded: an insertion-ordered index evicts the oldest ids first.
 */
export function createRatingCache({
  store,
  now,
  maxEntries,
  ttlMs,
}: RatingCacheOptions): RatingCache {
  let index: Promise<number[]> | null = null;

  const loadIndex = () => {
    index ??= store.get([INDEX_KEY]).then(
      (items) => {
        const raw = items[INDEX_KEY];
        return Array.isArray(raw) ? raw.filter((id): id is number => Number.isSafeInteger(id)) : [];
      },
      (error: unknown) => {
        index = null; // retry on the next call instead of failing forever
        throw error;
      },
    );
    return index;
  };

  return {
    async get(id) {
      const key = entryKey(id);
      const entry = (await store.get([key]))[key];
      if (!isEntry(entry)) {
        return null;
      }
      if (entry.expires <= now()) {
        await store.remove([key]);
        return null;
      }
      return entry.rating;
    },

    async set(id, rating) {
      if (rating.status === 'blocked') {
        return;
      }
      const ids = await loadIndex();
      const existing = ids.indexOf(id);
      if (existing !== -1) {
        ids.splice(existing, 1);
      }
      ids.push(id);
      const evicted = ids.splice(0, Math.max(0, ids.length - maxEntries));
      const entry: Entry = { rating, expires: now() + ttlMs[rating.status] };
      await store.set({ [entryKey(id)]: entry, [INDEX_KEY]: ids });
      if (evicted.length > 0) {
        await store.remove(evicted.map(entryKey));
      }
    },

    async clear() {
      const ids = await loadIndex();
      await store.remove([INDEX_KEY, ...ids.map(entryKey)]);
      ids.length = 0;
    },
  };
}

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && typeof value['expires'] === 'number' && isRating(value['rating']);
}
