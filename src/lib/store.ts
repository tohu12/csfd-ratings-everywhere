/** The subset of `browser.storage.StorageArea` the extension relies on (injected for tests). */
export interface KeyValueStore {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export type Clock = () => number;
