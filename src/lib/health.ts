import { isRecord } from './rating';
import type { KeyValueStore } from './store';

/** The two kinds of ČSFD pages the extension reads. */
export type CsfdPage = 'film' | 'search';

export interface CsfdHealth {
  /** A 2xx, non-Anubis ČSFD page: whether the parser could read it. */
  record(page: CsfdPage, readable: boolean): Promise<void>;
  /** Page kinds that ČSFD seems to have changed (SPEC §6a). */
  broken(): Promise<CsfdPage[]>;
}

export interface HealthOptions {
  /** `storage.local`: the popup reads the same key. */
  store: KeyValueStore;
  /** Called when the overall state flips: true = some page kind is unreadable. */
  onChange: (broken: boolean) => void;
}

/** Unreadable pages of one kind in a row before the extension says ČSFD changed. */
export const BROKEN_AFTER = 3;
const KEY = 'csfdHealth';
const PAGES: readonly CsfdPage[] = ['film', 'search'];

type State = Record<CsfdPage, number>;

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;

async function read(store: KeyValueStore): Promise<State> {
  const raw = (await store.get([KEY]))[KEY];
  const value = isRecord(raw) ? raw : {};
  return { film: count(value['film']), search: count(value['search']) };
}

const brokenIn = (state: State): CsfdPage[] => PAGES.filter((page) => state[page] >= BROKEN_AFTER);

/** Counts unreadable ČSFD pages in a row, per kind; a readable page resets its kind. */
export function createHealth({ store, onChange }: HealthOptions): CsfdHealth {
  const update = async (page: CsfdPage, readable: boolean): Promise<void> => {
    const before = await read(store);
    // Nothing to write in the common case (readable) or once the kind is already flagged.
    if (readable ? before[page] === 0 : before[page] >= BROKEN_AFTER) {
      return;
    }
    const after = { ...before, [page]: readable ? 0 : before[page] + 1 };
    await (after.film + after.search === 0 ? store.remove([KEY]) : store.set({ [KEY]: after }));
    const wasBroken = brokenIn(before).length > 0;
    const isBroken = brokenIn(after).length > 0;
    if (wasBroken !== isBroken) {
      onChange(isBroken);
    }
  };
  // Two ČSFD requests run at once: serialise the read-modify-write so no result is lost.
  let queue: Promise<void> = Promise.resolve();
  return {
    record(page, readable) {
      const next = queue.then(() => update(page, readable));
      queue = next.catch(() => {});
      return next;
    },
    broken: async () => brokenIn(await read(store)),
  };
}

/** For the popup: the page kinds the background flagged. */
export async function readBrokenPages(store: KeyValueStore): Promise<CsfdPage[]> {
  return brokenIn(await read(store));
}

/** After an update the parser may be fixed: start counting afresh (SPEC §6a). */
export async function clearHealth(store: KeyValueStore): Promise<void> {
  await store.remove([KEY]);
}
