import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROKEN_AFTER,
  type CsfdHealth,
  clearHealth,
  createHealth,
  readBrokenPages,
} from '@/lib/health';
import { type MemoryStore, memoryStore } from '../helpers/memory-store';

describe('createHealth', () => {
  let store: MemoryStore;
  let onChange: ReturnType<typeof vi.fn<(broken: boolean) => void>>;
  let health: CsfdHealth;

  const fail = async (page: 'film' | 'search', times: number) => {
    for (let i = 0; i < times; i++) {
      await health.record(page, false);
    }
  };

  beforeEach(() => {
    store = memoryStore();
    onChange = vi.fn();
    health = createHealth({ store, onChange });
  });

  it(`flags a page type after ${BROKEN_AFTER} unreadable pages in a row, once`, async () => {
    await fail('film', BROKEN_AFTER - 1);
    expect(await health.broken()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    await fail('film', 2);
    expect(await health.broken()).toEqual(['film']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('clears the flag on the next readable page of that type', async () => {
    await fail('search', BROKEN_AFTER);
    await health.record('search', true);
    expect(await health.broken()).toEqual([]);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(store.data.has('csfdHealth')).toBe(false);
  });

  it('counts film pages and searches separately', async () => {
    await fail('search', BROKEN_AFTER);
    await health.record('film', true); // working film pages must not hide a broken search parser
    expect(await health.broken()).toEqual(['search']);
    await fail('film', BROKEN_AFTER);
    expect(await health.broken()).toEqual(['film', 'search']);
    expect(onChange).toHaveBeenCalledTimes(1); // still broken, no second notice
    await health.record('search', true);
    expect(onChange).toHaveBeenCalledTimes(1); // films are still broken
  });

  it('counts concurrent results without losing any', async () => {
    await Promise.all(Array.from({ length: BROKEN_AFTER }, () => health.record('film', false)));
    expect(await health.broken()).toEqual(['film']);
  });

  it('stops writing once a page type is flagged', async () => {
    await fail('film', BROKEN_AFTER);
    const set = vi.spyOn(store, 'set');
    await fail('film', 5);
    expect(set).not.toHaveBeenCalled();
  });

  it('survives a failing store', async () => {
    const failing = createHealth({
      store: {
        ...memoryStore(),
        get: async () => {
          throw new Error('gone');
        },
      },
      onChange,
    });
    await expect(failing.record('film', false)).rejects.toThrow('gone');
    await failing.record('film', true).catch(() => {});
    expect(onChange).not.toHaveBeenCalled();
  });

  it('writes nothing while everything is readable', async () => {
    const set = vi.spyOn(store, 'set');
    await health.record('film', true);
    expect(set).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores corrupt stored state', async () => {
    store.data.set('csfdHealth', { film: 'x', search: -1 });
    expect(await health.broken()).toEqual([]);
    store.data.set('csfdHealth', 'junk');
    await fail('film', 1);
    expect(store.data.get('csfdHealth')).toEqual({ film: 1, search: 0 });
  });
});

describe('readBrokenPages', () => {
  it('reads the flag the background stored (for the popup)', async () => {
    const store = memoryStore({ csfdHealth: { film: 0, search: BROKEN_AFTER } });
    expect(await readBrokenPages(store)).toEqual(['search']);
    expect(await readBrokenPages(memoryStore())).toEqual([]);
  });
});

describe('clearHealth', () => {
  it('forgets the counters (an update may have fixed the parser)', async () => {
    const store = memoryStore({ csfdHealth: { film: BROKEN_AFTER, search: 0 } });
    await clearHealth(store);
    expect(await readBrokenPages(store)).toEqual([]);
  });
});
