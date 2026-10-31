import { beforeEach, describe, expect, it } from 'vitest';
import { type Backoff, createBackoff } from '@/lib/backoff';
import { type MemoryStore, memoryStore } from '../helpers/memory-store';

describe('createBackoff', () => {
  let store: MemoryStore;
  let time: number;
  let backoff: Backoff;

  beforeEach(() => {
    store = memoryStore();
    time = 0;
    backoff = createBackoff({ store, now: () => time, baseMs: 100, maxMs: 350 });
  });

  it('is open initially', async () => {
    expect(await backoff.isBlocked()).toBe(false);
  });

  it('pauses exponentially, capped at maxMs', async () => {
    await backoff.trip();
    expect(await backoff.isBlocked()).toBe(true);
    time = 100;
    expect(await backoff.isBlocked()).toBe(false);
    await backoff.trip(); // 200
    time = 299;
    expect(await backoff.isBlocked()).toBe(true);
    time = 300;
    await backoff.trip(); // 400 → capped 350
    time = 649;
    expect(await backoff.isBlocked()).toBe(true);
    time = 650;
    expect(await backoff.isBlocked()).toBe(false);
  });

  it('pauses at least minPauseMs (Retry-After), still capped', async () => {
    await backoff.trip(300);
    time = 299;
    expect(await backoff.isBlocked()).toBe(true);
    time = 300;
    expect(await backoff.isBlocked()).toBe(false);
    await backoff.trip(10_000);
    time = 300 + 349;
    expect(await backoff.isBlocked()).toBe(true);
    time = 300 + 350;
    expect(await backoff.isBlocked()).toBe(false);
  });

  it('reset clears the level so the next pause starts from base', async () => {
    await backoff.trip();
    await backoff.trip();
    await backoff.reset();
    expect(store.data.size).toBe(0);
    await backoff.trip();
    time = 100;
    expect(await backoff.isBlocked()).toBe(false);
  });

  it('reset is a no-op when not tripped', async () => {
    await backoff.reset();
    expect(store.data.size).toBe(0);
  });

  it('survives a restart (state lives in the store)', async () => {
    await backoff.trip();
    const restarted = createBackoff({ store, now: () => time, baseMs: 100, maxMs: 350 });
    expect(await restarted.isBlocked()).toBe(true);
  });

  it('treats corrupted state as open', async () => {
    store = memoryStore({ backoff: { level: 'x', until: 5 } });
    backoff = createBackoff({ store, now: () => time, baseMs: 100, maxMs: 350 });
    expect(await backoff.isBlocked()).toBe(false);
  });
});
