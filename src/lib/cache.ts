import type { Match } from './csfd-search';
import { isRating, isRecord, type Rating } from './rating';
import type { Clock, KeyValueStore } from './store';

export interface Cache<K, V> {
  get(key: K): Promise<V | null>;
  set(key: K, value: V): Promise<void>;
  clear(): Promise<void>;
}

export type RatingCache = Cache<number, Rating>;
/** Normalised VOD title query → ČSFD id, or why there is none. */
export type LookupCache = Cache<string, Match>;

export interface RatingCacheOptions {
  store: KeyValueStore;
  now: Clock;
  maxEntries: number;
  ttlMs: { ok: number; none: number; error: number };
}

export interface LookupCacheOptions {
  store: KeyValueStore;
  now: Clock;
  maxEntries: number;
  ttlMs: { found: number; unsure: number };
}

const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_TTL = { ok: 7 * DAY, none: DAY, error: DAY } as const;
export const DEFAULT_LOOKUP_TTL = { found: 30 * DAY, unsure: DAY } as const;
export const DEFAULT_MAX_ENTRIES = 2000;
// Lookups are only needed for titles opened on VOD sites; keep the index small.
export const DEFAULT_LOOKUP_MAX_ENTRIES = 500;

interface TtlCacheOptions<K, V> {
  store: KeyValueStore;
  now: Clock;
  maxEntries: number;
  indexKey: string;
  entryKey: (key: K) => string;
  isKey: (value: unknown) => value is K;
  isValue: (value: unknown) => value is V;
  /** Lifetime of a value; null means "do not cache". */
  ttlMs: (value: V) => number | null;
  /** Property holding the value inside a stored `{ <field>, expires }` entry. */
  entryField: string;
}

interface Entry<V> {
  value: V;
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
  return createTtlCache<number, Rating>({
    store,
    now,
    maxEntries,
    indexKey: 'ratings:index',
    entryKey: (id) => `rating:${id}`,
    isKey: (value): value is number => Number.isSafeInteger(value),
    isValue: isRating,
    ttlMs: (rating) => (rating.status === 'blocked' ? null : ttlMs[rating.status]),
    // Entries were stored as { rating, expires } before the cache became generic.
    entryField: 'rating',
  });
}

/** Lookup cache over `storage.local`: a found id lives long, an unsure answer one day. */
export function createLookupCache({
  store,
  now,
  maxEntries,
  ttlMs,
}: LookupCacheOptions): LookupCache {
  return createTtlCache<string, Match>({
    store,
    now,
    maxEntries,
    indexKey: 'lookups:index',
    entryKey: (key) => `lookup:${key}`,
    isKey: (value): value is string => typeof value === 'string',
    isValue: isMatch,
    ttlMs: (match) => (typeof match === 'number' ? ttlMs.found : ttlMs.unsure),
    entryField: 'match',
  });
}

export function isMatch(value: unknown): value is Match {
  return (
    value === 'ambiguous' ||
    value === 'notfound' ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  );
}

function createTtlCache<K, V>({
  store,
  now,
  maxEntries,
  indexKey,
  entryKey,
  isKey,
  isValue,
  ttlMs,
  entryField,
}: TtlCacheOptions<K, V>): Cache<K, V> {
  let index: Promise<K[]> | null = null;

  const loadIndex = () => {
    index ??= store.get([indexKey]).then(
      (items) => {
        const raw = items[indexKey];
        return Array.isArray(raw) ? raw.filter(isKey) : [];
      },
      (error: unknown) => {
        index = null; // retry on the next call instead of failing forever
        throw error;
      },
    );
    return index;
  };

  const readEntry = (raw: unknown): Entry<V> | null => {
    if (!isRecord(raw) || typeof raw['expires'] !== 'number') {
      return null;
    }
    const value = raw[entryField];
    return isValue(value) ? { value, expires: raw['expires'] } : null;
  };

  return {
    async get(key) {
      const storageKey = entryKey(key);
      const entry = readEntry((await store.get([storageKey]))[storageKey]);
      if (!entry) {
        return null;
      }
      if (entry.expires <= now()) {
        await store.remove([storageKey]);
        return null;
      }
      return entry.value;
    },

    async set(key, value) {
      const ttl = ttlMs(value);
      if (ttl === null) {
        return;
      }
      const keys = await loadIndex();
      const existing = keys.indexOf(key);
      if (existing !== -1) {
        keys.splice(existing, 1);
      }
      keys.push(key);
      const evicted = keys.splice(0, Math.max(0, keys.length - maxEntries));
      const entry = { [entryField]: value, expires: now() + ttl };
      await store.set({ [entryKey(key)]: entry, [indexKey]: keys });
      if (evicted.length > 0) {
        await store.remove(evicted.map(entryKey));
      }
    },

    async clear() {
      const keys = await loadIndex();
      await store.remove([indexKey, ...keys.map(entryKey)]);
      keys.length = 0;
    },
  };
}
