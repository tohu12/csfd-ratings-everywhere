import type { KeyValueStore } from '@/lib/store';

export interface MemoryStore extends KeyValueStore {
  readonly data: Map<string, unknown>;
}

/** In-memory KeyValueStore that, like browser storage, round-trips values through JSON. */
export function memoryStore(initial: Record<string, unknown> = {}): MemoryStore {
  const data = new Map<string, unknown>(Object.entries(initial));
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    data,
    async get(keys) {
      return Object.fromEntries(
        keys.filter((k) => data.has(k)).map((k) => [k, clone(data.get(k))]),
      );
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) {
        data.set(k, clone(v));
      }
    },
    async remove(keys) {
      for (const k of keys) {
        data.delete(k);
      }
    },
  };
}
