import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLimiter, type Limiter, QueueFullError } from '@/lib/queue';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createLimiter', () => {
  let limit: Limiter;
  let started: number[];

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    started = [];
    limit = createLimiter({
      concurrency: 2,
      minIntervalMs: 400,
      maxPending: 10,
      now: () => Date.now(),
      setTimer: (cb, ms) => setTimeout(cb, ms),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const task = (id: number, d: ReturnType<typeof deferred<number>>) => () => {
    started.push(id);
    return d.promise;
  };

  it('spaces task starts by minIntervalMs', async () => {
    const a = deferred<number>();
    const b = deferred<number>();
    void limit(task(1, a));
    void limit(task(2, b));
    expect(started).toEqual([1]);
    await vi.advanceTimersByTimeAsync(399);
    expect(started).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(started).toEqual([1, 2]);
  });

  it('rejects a task that throws synchronously and frees its slot', async () => {
    const boom = () => {
      throw new URIError('URI malformed');
    };
    const failures = [limit(boom), limit(boom)].map((p) => p.catch((error: unknown) => error));
    await vi.advanceTimersByTimeAsync(400);
    expect(await Promise.all(failures)).toEqual([expect.any(URIError), expect.any(URIError)]);
    const ok = limit(async () => 7);
    await vi.advanceTimersByTimeAsync(400);
    await expect(ok).resolves.toBe(7);
  });

  it('never runs more than `concurrency` tasks at once', async () => {
    const ds = [deferred<number>(), deferred<number>(), deferred<number>()];
    const results = ds.map((d, i) => limit(task(i, d)));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(started).toEqual([0, 1]);
    ds[0]?.resolve(10);
    await expect(results[0]).resolves.toBe(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual([0, 1, 2]);
  });

  it('propagates rejections and keeps going', async () => {
    const a = deferred<number>();
    const b = deferred<number>();
    const ra = limit(task(1, a));
    const rb = limit(task(2, b));
    a.reject(new Error('boom'));
    await expect(ra).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(400);
    b.resolve(2);
    await expect(rb).resolves.toBe(2);
  });

  it('rejects tasks beyond maxPending with QueueFullError', async () => {
    limit = createLimiter({
      concurrency: 1,
      minIntervalMs: 0,
      maxPending: 1,
      now: () => Date.now(),
      setTimer: (cb, ms) => setTimeout(cb, ms),
    });
    void limit(task(1, deferred<number>())); // running
    void limit(task(2, deferred<number>())); // waiting
    await expect(limit(task(3, deferred<number>()))).rejects.toBeInstanceOf(QueueFullError);
    expect(new QueueFullError().name).toBe('QueueFullError');
  });

  it('arms only one timer while waiting', async () => {
    const setTimer = vi.fn((cb: () => void, ms: number) => setTimeout(cb, ms));
    limit = createLimiter({
      concurrency: 5,
      minIntervalMs: 400,
      maxPending: 10,
      now: () => Date.now(),
      setTimer,
    });
    for (let i = 0; i < 4; i++) {
      void limit(task(i, deferred<number>()));
    }
    expect(setTimer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_200);
    expect(started).toEqual([0, 1, 2, 3]);
  });
});
