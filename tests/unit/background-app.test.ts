import { describe, expect, it, vi } from 'vitest';
import { createBackgroundApp, createFetchPage, createMessageHandler } from '@/lib/background-app';
import type { LookupCache, RatingCache } from '@/lib/cache';
import type { RatingService } from '@/lib/rating-service';
import { fixture } from '../helpers/fixtures';
import { memoryStore } from '../helpers/memory-store';

const SELF = { id: 'self' };

describe('createMessageHandler', () => {
  const service: RatingService = {
    getRating: vi.fn(async () => ({ status: 'error' }) as const),
    peekRating: vi.fn(async () => null),
    findTitle: vi.fn(async () => ({ status: 'unsure' }) as const),
  };
  const cache = { clear: vi.fn(async () => {}) } as unknown as RatingCache;
  const lookups = { clear: vi.fn(async () => {}) } as unknown as LookupCache;
  const handle = createMessageHandler({ service, caches: [cache, lookups], runtimeId: 'self' });

  it('answers getRating from the service', async () => {
    await expect(handle({ type: 'getRating', id: 5 }, SELF)).resolves.toEqual({ status: 'error' });
    expect(service.getRating).toHaveBeenCalledWith(5);
  });

  it('answers peekRating from the cache only', async () => {
    await expect(handle({ type: 'peekRating', id: 6 }, SELF)).resolves.toBeNull();
    expect(service.peekRating).toHaveBeenCalledWith(6);
  });

  it('answers findTitle from the service with only the query fields', async () => {
    const message = { type: 'findTitle', titles: ['Duna'], year: 2021, kind: 'film', extra: 1 };
    await expect(handle(message, SELF)).resolves.toEqual({ status: 'unsure' });
    expect(service.findTitle).toHaveBeenCalledWith({ titles: ['Duna'], year: 2021, kind: 'film' });
  });

  it('clears the rating and lookup caches', async () => {
    await expect(handle({ type: 'clearCache' }, SELF)).resolves.toBe(true);
    expect(cache.clear).toHaveBeenCalled();
    expect(lookups.clear).toHaveBeenCalled();
  });

  it('ignores invalid messages and foreign senders', () => {
    expect(handle({ type: 'nope' }, SELF)).toBeUndefined();
    expect(handle({ type: 'clearCache' }, { id: 'other-extension' })).toBeUndefined();
    expect(handle({ type: 'clearCache' }, {})).toBeUndefined();
  });
});

describe('createFetchPage', () => {
  it('sends a plain request with the user cookies and returns status + text', async () => {
    const fetchFn = vi.fn(
      async () => new Response('<html>', { status: 201, headers: { 'Retry-After': '30' } }),
    );
    const fetchPage = createFetchPage(fetchFn);
    await expect(fetchPage('https://www.csfd.cz/film/1/prehled/')).resolves.toEqual({
      status: 201,
      text: '<html>',
      retryAfter: '30',
    });
    expect(fetchFn).toHaveBeenCalledWith('https://www.csfd.cz/film/1/prehled/', {
      credentials: 'include',
      redirect: 'follow',
    });
  });
});

describe('createBackgroundApp', () => {
  it('wires cache, service and handler end-to-end', async () => {
    const fetchFn = vi.fn(async () => new Response(fixture('csfd/film.html')));
    const local = memoryStore();
    const handle = createBackgroundApp({
      runtimeId: 'self',
      local,
      session: memoryStore(),
      fetch: fetchFn,
      now: () => 0,
      setTimer: (cb, ms) => setTimeout(cb, ms),
    });
    await expect(handle({ type: 'getRating', id: 7 }, SELF)).resolves.toMatchObject({
      percent: 65,
    });
    expect(local.data.has('rating:7')).toBe(true);
    await handle({ type: 'clearCache' }, SELF);
    expect(local.data.size).toBe(0);
  });
});
