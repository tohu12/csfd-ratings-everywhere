import type { Clock } from './store';

export class QueueFullError extends Error {
  constructor() {
    super('Rate limiter queue is full');
    this.name = 'QueueFullError';
  }
}

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export interface LimiterOptions {
  concurrency: number;
  /** Minimum time between two task starts. */
  minIntervalMs: number;
  /** Tasks waiting beyond this are rejected with QueueFullError instead of piling up. */
  maxPending: number;
  now: Clock;
  setTimer: (callback: () => void, ms: number) => unknown;
}

/** FIFO limiter: at most `concurrency` tasks at once, starts spaced by `minIntervalMs`. */
export function createLimiter({
  concurrency,
  minIntervalMs,
  maxPending,
  now,
  setTimer,
}: LimiterOptions): Limiter {
  const pending: Array<() => void> = [];
  let active = 0;
  let lastStart = Number.NEGATIVE_INFINITY;
  let timerArmed = false;

  const pump = (): void => {
    while (active < concurrency) {
      const next = pending.shift();
      if (!next) {
        return;
      }
      const wait = lastStart + minIntervalMs - now();
      if (wait > 0) {
        pending.unshift(next);
        if (!timerArmed) {
          timerArmed = true;
          setTimer(() => {
            timerArmed = false;
            pump();
          }, wait);
        }
        return;
      }
      lastStart = now();
      active++;
      next();
    }
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      if (pending.length >= maxPending) {
        reject(new QueueFullError());
        return;
      }
      pending.push(() => {
        // A task that throws synchronously must still free its slot.
        new Promise<T>((run) => run(task())).then(resolve, reject).finally(() => {
          active--;
          pump();
        });
      });
      pump();
    });
}
