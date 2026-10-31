import { vi } from 'vitest';
import type { IdleDeadlineLike } from '@/lib/scanner';

/** Idle scheduler driven by the test. `budget` = how many nodes fit into one idle period. */
export function manualIdle() {
  const queue: Array<(deadline: IdleDeadlineLike) => void> = [];
  return {
    schedule: (cb: (deadline: IdleDeadlineLike) => void) => {
      queue.push(cb);
    },
    get pending() {
      return queue.length;
    },
    /** Runs one queued idle callback; `budget` timeRemaining() checks return > 0. */
    runOne(budget = Number.POSITIVE_INFINITY) {
      let left = budget;
      queue.shift()?.({ timeRemaining: () => (left-- > 0 ? 10 : 0) });
    },
    runAll() {
      while (queue.length > 0) {
        this.runOne();
      }
    },
  };
}

/** Timer driven by the test. `set` returns a handle that `clear` accepts. */
export function manualTimers() {
  const timers: Array<{ cb: () => void; ms: number }> = [];
  return {
    set: (cb: () => void, ms: number) => {
      const timer = { cb, ms };
      timers.push(timer);
      return timer;
    },
    clear: (handle: unknown) => {
      const index = timers.indexOf(handle as { cb: () => void; ms: number });
      if (index !== -1) {
        timers.splice(index, 1);
      }
    },
    get pending() {
      return timers.map((t) => t.ms);
    },
    runAll() {
      while (timers.length > 0) {
        timers.shift()?.cb();
      }
    },
  };
}

/** MutationObserver whose callback the test fires with chosen added nodes. */
export function fakeMutationObserver() {
  let callback: MutationCallback = () => {};
  const observer = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: () => [],
  } as unknown as MutationObserver;
  return {
    create: (cb: MutationCallback) => {
      callback = cb;
      return observer;
    },
    observer,
    add(...nodes: Node[]) {
      callback([{ addedNodes: nodes } as unknown as MutationRecord], observer);
    },
  };
}

/** IntersectionObserver whose visibility the test controls. */
export function fakeIntersectionObserver() {
  let callback: IntersectionObserverCallback = () => {};
  const observed = new Set<Element>();
  const observer = {
    observe: vi.fn((el: Element) => observed.add(el)),
    unobserve: vi.fn((el: Element) => observed.delete(el)),
    disconnect: vi.fn(() => observed.clear()),
  } as unknown as IntersectionObserver;
  return {
    create: (cb: IntersectionObserverCallback) => {
      callback = cb;
      return observer;
    },
    observer,
    observed,
    show(el: Element, isIntersecting = true) {
      callback([{ target: el, isIntersecting } as IntersectionObserverEntry], observer);
    },
    showAll() {
      for (const el of [...observed]) {
        this.show(el);
      }
    },
  };
}
