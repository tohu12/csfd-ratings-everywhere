import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackoff } from '@/lib/backoff';
import { createRatingCache, DEFAULT_TTL } from '@/lib/cache';
import type { Limiter } from '@/lib/queue';
import type { Rating } from '@/lib/rating';
import { createRatingService, type FetchPage, retryAfterMs } from '@/lib/rating-service';
import { fixture } from '../helpers/fixtures';
import { memoryStore } from '../helpers/memory-store';

const passThrough: Limiter = (task) => task();
const FILM: Rating = { status: 'ok', percent: 65, count: 1234, title: 'Coutures & spol.' };

function setup(fetchPage: FetchPage, limiter: Limiter = passThrough) {
  let time = 0;
  const now = () => time;
  const local = memoryStore();
  const session = memoryStore();
  const cache = createRatingCache({ store: local, now, maxEntries: 10, ttlMs: DEFAULT_TTL });
  const backoff = createBackoff({ store: session, now, baseMs: 1000, maxMs: 8000 });
  const fetchSpy = vi.fn(fetchPage);
  const service = createRatingService({ cache, backoff, limiter, fetchPage: fetchSpy });
  return { service, fetchSpy, cache, backoff, advance: (ms: number) => (time += ms) };
}

const page =
  (name: string, status = 200, retryAfter: string | null = null) =>
  async () => ({ status, text: fixture(name), retryAfter });

describe('createRatingService', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup(page('csfd/film.html'));
  });

  it('fetches the canonical page and parses the rating', async () => {
    expect(await s.service.getRating(1700849)).toEqual(FILM);
    expect(s.fetchSpy).toHaveBeenCalledWith('https://www.csfd.cz/film/1700849/prehled/');
  });

  it('peekRating reads the cache only and never fetches', async () => {
    expect(await s.service.peekRating(1)).toBeNull();
    expect(s.fetchSpy).not.toHaveBeenCalled();
    await s.service.getRating(1);
    expect(await s.service.peekRating(1)).toEqual(FILM);
    vi.spyOn(s.cache, 'get').mockRejectedValueOnce(new Error('unavailable'));
    expect(await s.service.peekRating(1)).toBeNull();
  });

  it('serves the second request from cache', async () => {
    await s.service.getRating(1);
    expect(await s.service.getRating(1)).toEqual(FILM);
    expect(s.fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('shares one fetch between concurrent requests for the same id', async () => {
    const [a, b] = await Promise.all([s.service.getRating(1), s.service.getRating(1)]);
    expect(a).toEqual(FILM);
    expect(b).toBe(a);
    expect(s.fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches none ratings', async () => {
    s = setup(page('csfd/no-rating.html'));
    await s.service.getRating(1);
    expect(await s.service.getRating(1)).toEqual({ status: 'none', title: 'Poberta' });
    expect(s.fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns error for network failures without caching', async () => {
    s = setup(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
    await s.service.getRating(1);
    expect(s.fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns error for other non-2xx responses without caching', async () => {
    s = setup(page('csfd/film.html', 500));
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
    await s.service.getRating(1);
    expect(s.fetchSpy).toHaveBeenCalledTimes(2);
    s = setup(page('csfd/film.html', 199));
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
  });

  it.each([404, 410])('caches %i as error so a missing film is not re-fetched', async (status) => {
    s = setup(page('csfd/film.html', status));
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
    expect(s.fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])('pauses all requests on %i, honouring Retry-After', async (status) => {
    s = setup(page('csfd/film.html', status, '5'));
    expect(await s.service.getRating(1)).toEqual({ status: 'blocked' });
    s.advance(4999);
    expect(await s.service.getRating(2)).toEqual({ status: 'blocked' });
    expect(s.fetchSpy).toHaveBeenCalledTimes(1);
    s.advance(1);
    s.fetchSpy.mockImplementation(page('csfd/film.html'));
    expect(await s.service.getRating(2)).toEqual(FILM);
  });

  it('keeps a good rating when storage writes fail', async () => {
    s = setup(page('csfd/film.html'));
    vi.spyOn(s.cache, 'set').mockRejectedValue(new Error('QUOTA_BYTES'));
    vi.spyOn(s.backoff, 'reset').mockRejectedValue(new Error('unavailable'));
    expect(await s.service.getRating(1)).toEqual(FILM);
  });

  it('returns error when the limiter or cache throws unexpectedly', async () => {
    s = setup(page('csfd/film.html'), () => Promise.reject(new Error('boom')));
    expect(await s.service.getRating(1)).toEqual({ status: 'error' });
  });

  describe('when ČSFD answers with Anubis', () => {
    beforeEach(() => {
      s = setup(page('csfd/anubis-reject.html', 403));
    });

    it('returns blocked and stops all requests during the backoff', async () => {
      expect(await s.service.getRating(1)).toEqual({ status: 'blocked' });
      expect(await s.service.getRating(2)).toEqual({ status: 'blocked' });
      expect(s.fetchSpy).toHaveBeenCalledTimes(1);
      s.advance(1000);
      await s.service.getRating(3);
      expect(s.fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('trips the backoff only once for concurrent blocked responses', async () => {
      const tripSpy = vi.spyOn(s.backoff, 'trip');
      await Promise.all([s.service.getRating(1), s.service.getRating(2)]);
      expect(tripSpy).toHaveBeenCalledTimes(1);
    });

    it('re-checks the backoff after waiting in the queue', async () => {
      let chain: Promise<unknown> = Promise.resolve();
      const serial: Limiter = (task) => {
        const run = chain.then(task);
        chain = run.catch(() => {});
        return run;
      };
      s = setup(page('csfd/anubis-reject.html'), serial);
      await Promise.all([s.service.getRating(1), s.service.getRating(2)]);
      // Both passed the pre-queue check; the queued one must not hit the network after the trip.
      expect(s.fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not trip again for a late blocked response while already blocked', async () => {
      const releases: Array<() => void> = [];
      s = setup(
        () =>
          new Promise((resolve) => {
            releases.push(() =>
              resolve({ status: 403, text: fixture('csfd/anubis-reject.html'), retryAfter: null }),
            );
          }),
      );
      const tripSpy = vi.spyOn(s.backoff, 'trip');
      const first = s.service.getRating(1);
      const second = s.service.getRating(2);
      await vi.waitFor(() => expect(releases).toHaveLength(2));
      releases[0]?.();
      await first;
      releases[1]?.();
      await second;
      expect(tripSpy).toHaveBeenCalledTimes(1);
    });

    it('trips again for a blocked response after an earlier trip settled', async () => {
      await s.service.getRating(1);
      s.advance(1000);
      const tripSpy = vi.spyOn(s.backoff, 'trip');
      await s.service.getRating(2);
      expect(tripSpy).toHaveBeenCalledTimes(1);
    });

    it('resets the backoff after the next successful fetch', async () => {
      await s.service.getRating(1);
      s.advance(1000);
      s.fetchSpy.mockImplementation(page('csfd/film.html'));
      const resetSpy = vi.spyOn(s.backoff, 'reset');
      expect(await s.service.getRating(2)).toEqual(FILM);
      expect(resetSpy).toHaveBeenCalled();
      expect(await s.backoff.isBlocked()).toBe(false);
    });
  });
});

describe('retryAfterMs', () => {
  it.each([
    [null, 0],
    ['120', 120_000],
    ['-5', 0],
    ['Thu, 01 Jan 1970 00:00:10 GMT', 10_000],
    ['Thu, 01 Jan 1970 00:00:00 GMT', 0],
    ['soon', 0],
  ])('%j → %i ms', (header, ms) => {
    expect(retryAfterMs(header, 0)).toBe(ms);
  });

  it('defaults to the current time', () => {
    expect(retryAfterMs(new Date(Date.now() + 60_000).toUTCString())).toBeGreaterThan(50_000);
  });
});
