import { isRecord } from './rating';
import type { Clock, KeyValueStore } from './store';

export interface Backoff {
  isBlocked(): Promise<boolean>;
  /** Pauses for the next exponential step, or at least `minPauseMs` (e.g. from Retry-After). */
  trip(minPauseMs?: number): Promise<void>;
  reset(): Promise<void>;
}

export interface BackoffOptions {
  /** `storage.session`: survives service-worker restarts, cleared with the browser session. */
  store: KeyValueStore;
  now: Clock;
  baseMs: number;
  maxMs: number;
}

const KEY = 'backoff';

interface State {
  level: number;
  until: number;
}

/** Exponential pause after ČSFD bot protection answered instead of the film page. */
export function createBackoff({ store, now, baseMs, maxMs }: BackoffOptions): Backoff {
  const read = async (): Promise<State> => {
    const raw = (await store.get([KEY]))[KEY];
    return isRecord(raw) && typeof raw['level'] === 'number' && typeof raw['until'] === 'number'
      ? { level: raw['level'], until: raw['until'] }
      : { level: 0, until: 0 };
  };

  return {
    async isBlocked() {
      return (await read()).until > now();
    },
    async trip(minPauseMs = 0) {
      const { level } = await read();
      const pause = Math.min(maxMs, Math.max(minPauseMs, baseMs * 2 ** level));
      await store.set({ [KEY]: { level: level + 1, until: now() + pause } });
    },
    async reset() {
      if ((await read()).level > 0) {
        await store.remove([KEY]);
      }
    },
  };
}
