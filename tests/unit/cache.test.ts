import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRatingCache, DEFAULT_TTL, type RatingCache } from '@/lib/cache';
import type { Rating } from '@/lib/rating';
import { type MemoryStore, memoryStore } from '../helpers/memory-store';

const OK: Rating = { status: 'ok', percent: 78, count: 10, title: 'Film' };
const NONE: Rating = { status: 'none', title: 'Film' };

describe('createRatingCache', () => {
  let store: MemoryStore;
  let time: number;
  let cache: RatingCache;

  beforeEach(() => {
    store = memoryStore();
    time = 1_000;
    cache = createRatingCache({ store, now: () => time, maxEntries: 3, ttlMs: DEFAULT_TTL });
  });

  it('returns null for unknown ids', async () => {
    expect(await cache.get(1)).toBeNull();
  });

  it('stores and returns ok and none ratings', async () => {
    await cache.set(1, OK);
    await cache.set(2, NONE);
    expect(await cache.get(1)).toEqual(OK);
    expect(await cache.get(2)).toEqual(NONE);
  });

  it('never caches blocked', async () => {
    await cache.set(1, { status: 'blocked' });
    expect(store.data.size).toBe(0);
  });

  it('caches errors for the error TTL when asked to', async () => {
    await cache.set(1, { status: 'error' });
    expect(await cache.get(1)).toEqual({ status: 'error' });
    time += DEFAULT_TTL.error;
    expect(await cache.get(1)).toBeNull();
  });

  it('retries loading the index after a storage failure', async () => {
    const get = vi.spyOn(store, 'get').mockRejectedValueOnce(new Error('unavailable'));
    await expect(cache.set(1, OK)).rejects.toThrow('unavailable');
    get.mockRestore();
    await cache.set(1, OK);
    expect(await cache.get(1)).toEqual(OK);
  });

  it('expires ok after 7 days and none after 1 day, removing the stale entry', async () => {
    await cache.set(1, OK);
    await cache.set(2, NONE);
    time += DEFAULT_TTL.none;
    expect(await cache.get(2)).toBeNull();
    expect(store.data.has('rating:2')).toBe(false);
    expect(await cache.get(1)).toEqual(OK);
    time += DEFAULT_TTL.ok;
    expect(await cache.get(1)).toBeNull();
  });

  it('evicts the oldest entries beyond maxEntries', async () => {
    for (const id of [1, 2, 3, 4]) {
      await cache.set(id, OK);
    }
    expect(await cache.get(1)).toBeNull();
    expect(store.data.get('ratings:index')).toEqual([2, 3, 4]);
  });

  it('moves a re-written id to the newest position', async () => {
    await cache.set(1, OK);
    await cache.set(2, OK);
    await cache.set(3, OK);
    await cache.set(1, NONE);
    await cache.set(4, OK);
    expect(await cache.get(1)).toEqual(NONE);
    expect(await cache.get(2)).toBeNull();
  });

  it('ignores corrupted entries and a corrupted index', async () => {
    store = memoryStore({
      'rating:1': { rating: { status: 'ok', percent: 'x' }, expires: 9e15 },
      'rating:2': 'garbage',
      'ratings:index': 'garbage',
    });
    cache = createRatingCache({ store, now: () => time, maxEntries: 3, ttlMs: DEFAULT_TTL });
    expect(await cache.get(1)).toBeNull();
    expect(await cache.get(2)).toBeNull();
    await cache.set(3, OK);
    expect(store.data.get('ratings:index')).toEqual([3]);
  });

  it('drops non-integer ids from a persisted index', async () => {
    store = memoryStore({ 'ratings:index': [1, 'x', 2.5, 2] });
    cache = createRatingCache({ store, now: () => time, maxEntries: 3, ttlMs: DEFAULT_TTL });
    await cache.set(3, OK);
    expect(store.data.get('ratings:index')).toEqual([1, 2, 3]);
  });

  it('clear removes all entries and the index', async () => {
    await cache.set(1, OK);
    await cache.set(2, NONE);
    await cache.clear();
    expect(store.data.size).toBe(0);
    await cache.set(5, OK);
    expect(store.data.get('ratings:index')).toEqual([5]);
  });
});
