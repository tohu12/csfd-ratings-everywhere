import { type Badge, type BadgeOptions, createBadge } from './badge';
import { ratingUrl } from './csfd-url';
import { createHoverCard } from './hover-card';
import type { Translate } from './i18n';
import type { FoundLink } from './linkify';
import { type ContentStats, isContentRequest } from './messages';
import { ERROR, isRating, type Rating } from './rating';
import type { MessageHandler } from './runtime-listener';
import { createScanner, type ScannerDeps } from './scanner';
import { isHostEnabled, type Settings } from './settings';

/** Hover must rest this long before it counts as intent (filters mouse sweeps across a page). */
export const HOVER_INTENT_MS = 150;
/**
 * `element.focus()` from a page script fires a *trusted* focus event, so focus only counts
 * right after a real key press (Tab, arrows…), which scripts cannot fake.
 */
export const KEYBOARD_FOCUS_WINDOW_MS = 1000;
/** Distinct films per page fetched automatically when visible; the rest load on hover/focus. */
export const AUTO_LOAD_LIMIT = 10;

export interface ContentDeps {
  doc: Document;
  hostname: string;
  settings: Settings;
  t: Translate;
  formatCount: (count: number) => string;
  /** `getRating`: may hit the network. Only as SPEC §4 allows (first films per page, user actions). */
  requestRating: (id: number) => Promise<unknown>;
  /** `peekRating`: cache only, never the network. */
  peekRating: (id: number) => Promise<unknown>;
  /** `event.isTrusted` in production: page scripts must not be able to trigger requests. */
  isUserEvent: (event: Event) => boolean;
  createIntersectionObserver: (callback: IntersectionObserverCallback) => IntersectionObserver;
  scheduleIdle: ScannerDeps['scheduleIdle'];
  createMutationObserver: ScannerDeps['createMutationObserver'];
  setTimer: ScannerDeps['setTimer'];
  clearTimer: (handle: unknown) => void;
  now: () => number;
}

export interface ContentApp {
  stats(): ContentStats;
  stop(): void;
}

interface Decorator {
  decorate(found: FoundLink): void;
  /** Called after each batch of decorated links. */
  afterBatch(): void;
  stop(): void;
}

interface Ratings {
  /** Network-capable load; final answers (`ok`/`none`) are memoised for the page's lifetime. */
  load(id: number): Promise<Rating>;
  /** A final answer or a load already in flight for this film; never starts a request. */
  current(id: number): Promise<Rating> | undefined;
  /** Cache-only lookup, made at most once per film per page; `null` when unknown. */
  peek(id: number): Promise<Rating | null>;
}

const INERT: ContentApp = { stats: () => ({ links: 0 }), stop: () => {} };

/**
 * Linkifies ČSFD URLs and shows ratings as badges or hover cards. Cached ratings show at once;
 * the first AUTO_LOAD_LIMIT films load automatically when visible, the rest after a real hover/focus.
 */
export function startContentApp(deps: ContentDeps): ContentApp {
  const { doc, settings } = deps;
  if (!isHostEnabled(settings, deps.hostname) || !doc.body) {
    return INERT;
  }
  const ratings = createRatings(deps);
  const controller = new AbortController();
  const intent = createIntent(deps, controller.signal);
  const options: BadgeOptions = { t: deps.t, formatCount: deps.formatCount };
  const decorator =
    settings.display === 'tooltip'
      ? tooltipDecorator(doc, options, settings.showRatings, ratings, intent)
      : badgeDecorator(doc, options, settings.showRatings, ratings, intent, deps);

  let links = 0;
  const scanner = createScanner({
    root: doc.body,
    onLinks: (found) => {
      for (const item of found) {
        decorator.decorate(item);
        links++;
      }
      decorator.afterBatch();
    },
    scheduleIdle: deps.scheduleIdle,
    createMutationObserver: deps.createMutationObserver,
    setTimer: deps.setTimer,
    debounceMs: 300,
  });
  scanner.start();

  return {
    stats: () => ({ links }),
    stop() {
      scanner.stop();
      decorator.stop();
      controller.abort();
    },
  };
}

function createRatings(deps: ContentDeps): Ratings {
  const final = new Map<number, Rating>();
  const inFlight = new Map<number, Promise<Rating>>();
  const peeks = new Map<number, Promise<Rating | null>>();
  const remember = (id: number, rating: Rating) => {
    // `blocked`/`error` are transient: a later hover may succeed.
    if (rating.status === 'ok' || rating.status === 'none') {
      final.set(id, rating);
    }
  };

  return {
    load(id) {
      const known = final.get(id);
      if (known) {
        return Promise.resolve(known);
      }
      let promise = inFlight.get(id);
      if (!promise) {
        promise = deps
          .requestRating(id)
          .then(
            (value) => (isRating(value) ? value : ERROR),
            () => ERROR,
          )
          .then((rating) => {
            inFlight.delete(id);
            remember(id, rating);
            return rating;
          });
        inFlight.set(id, promise);
      }
      return promise;
    },
    current(id) {
      const known = final.get(id);
      return known ? Promise.resolve(known) : inFlight.get(id);
    },
    peek(id) {
      const known = final.get(id);
      if (known) {
        return Promise.resolve(known);
      }
      let promise = peeks.get(id);
      if (!promise) {
        promise = deps
          .peekRating(id)
          .catch(() => null)
          .then((value) => {
            if (!isRating(value)) {
              return null;
            }
            remember(id, value);
            return value;
          });
        peeks.set(id, promise);
      }
      return promise;
    },
  };
}

type Intent = (targets: Element[], handlers: { act: () => void; leave: () => void }) => void;

/** Real hover (after HOVER_INTENT_MS) or keyboard focus → `act`; leaving → `leave`. */
function createIntent(deps: ContentDeps, signal: AbortSignal): Intent {
  let lastKeyAt = Number.NEGATIVE_INFINITY;
  deps.doc.addEventListener(
    'keydown',
    (event) => {
      if (deps.isUserEvent(event)) {
        lastKeyAt = deps.now();
      }
    },
    { capture: true, signal },
  );
  const isKeyboardFocus = (event: Event) =>
    deps.isUserEvent(event) && deps.now() - lastKeyAt <= KEYBOARD_FOCUS_WINDOW_MS;

  return (targets, { act, leave }) => {
    let timer: unknown = null;
    const cancel = () => {
      if (timer !== null) {
        deps.clearTimer(timer);
        timer = null;
      }
    };
    const listen = { signal };
    for (const target of targets) {
      target.addEventListener(
        'mouseenter',
        (event) => {
          if (deps.isUserEvent(event)) {
            cancel();
            timer = deps.setTimer(() => {
              timer = null;
              act();
            }, HOVER_INTENT_MS);
          }
        },
        listen,
      );
      target.addEventListener(
        'focus',
        (event) => {
          if (isKeyboardFocus(event)) {
            act();
          }
        },
        listen,
      );
      for (const type of ['mouseleave', 'blur']) {
        target.addEventListener(
          type,
          () => {
            cancel();
            leave();
          },
          listen,
        );
      }
    }
  };
}

/**
 * Inline pill after each link. When it becomes visible: a cached rating is shown at once;
 * otherwise it is fetched, for at most AUTO_LOAD_LIMIT distinct films per page.
 * Everything else loads on hover/focus.
 */
function badgeDecorator(
  doc: Document,
  options: BadgeOptions,
  showRatings: boolean,
  ratings: Ratings,
  intent: Intent,
  deps: ContentDeps,
): Decorator {
  const waiting = new Map<Element, () => void>();
  const visibility = deps.createIntersectionObserver((entries) => {
    for (const entry of entries) {
      const onVisible = waiting.get(entry.target);
      if (entry.isIntersecting && onVisible) {
        forget(entry.target);
        onVisible();
      }
    }
  });
  const forget = (host: Element) => {
    waiting.delete(host);
    visibility.unobserve(host);
  };
  // Films auto-loaded on this page. Each film is tried at most once, even if that load fails;
  // further links to it join the running load or wait for a hover.
  const autoTried = new Set<number>();
  const mayAutoLoad = (id: number) => {
    if (autoTried.has(id) || autoTried.size >= AUTO_LOAD_LIMIT) {
      return false;
    }
    autoTried.add(id);
    return true;
  };

  return {
    decorate({ anchor, link }) {
      const badge = createBadge(doc, ratingUrl(link.id), options);
      anchor.after(badge.host);
      if (!showRatings) {
        badge.render({ kind: 'link' });
        return;
      }
      badge.render({ kind: 'idle' });
      const controller = badgeRating(badge, link.id, ratings, mayAutoLoad, () =>
        forget(badge.host),
      );
      waiting.set(badge.host, controller.onVisible);
      visibility.observe(badge.host);
      intent([anchor, badge.host], { act: controller.onUserAction, leave: () => {} });
    },
    afterBatch() {
      // Feeds and chats drop old content: release badges that left the page unseen.
      for (const host of [...waiting.keys()]) {
        if (!host.isConnected) {
          forget(host);
        }
      }
    },
    stop() {
      visibility.disconnect();
      waiting.clear();
    },
  };
}

/**
 * State machine of one badge: idle → loading → done. Transient failures return to idle so a
 * hover can retry; a failed *automatic* load stays quiet unless the user is waiting for it.
 */
function badgeRating(
  badge: Badge,
  id: number,
  ratings: Ratings,
  mayAutoLoad: (id: number) => boolean,
  stopWatching: () => void,
): { onVisible: () => void; onUserAction: () => void } {
  let state: 'idle' | 'loading' | 'done' = 'idle';
  let userWaiting = false;

  const show = (rating: Rating) => {
    state = rating.status === 'ok' || rating.status === 'none' ? 'done' : 'idle';
    badge.render({ kind: 'rating', rating });
  };
  const follow = (load: Promise<Rating>, byUser: boolean) => {
    state = 'loading';
    userWaiting = byUser;
    stopWatching();
    badge.render({ kind: 'loading' });
    void load.then((rating) => {
      if (rating.status === 'error' && !userWaiting) {
        state = 'idle';
        badge.render({ kind: 'idle' });
        return;
      }
      show(rating);
    });
  };
  const fromVisibility = (cached: Rating | null) => {
    if (state !== 'idle') {
      return;
    }
    if (cached) {
      show(cached);
      return;
    }
    const running = ratings.current(id);
    if (running) {
      follow(running, false);
    } else if (mayAutoLoad(id)) {
      follow(ratings.load(id), false);
    }
  };

  return {
    onVisible: () => {
      void ratings.peek(id).then(fromVisibility);
    },
    onUserAction: () => {
      if (state === 'idle') {
        follow(ratings.load(id), true);
      } else if (state === 'loading') {
        userWaiting = true; // answer this hover even if the automatic load fails
      }
    },
  };
}

/** Nothing inserted next to links; a floating card appears on hover or keyboard focus. */
function tooltipDecorator(
  doc: Document,
  options: BadgeOptions,
  showRatings: boolean,
  ratings: Ratings,
  intent: Intent,
): Decorator {
  const card = createHoverCard(doc, options);
  return {
    decorate({ anchor, link }) {
      intent([anchor], {
        act: () => {
          if (!showRatings) {
            card.show(anchor, { kind: 'link' });
            return;
          }
          card.show(anchor, { kind: 'loading' });
          void ratings
            .load(link.id)
            .then((rating) => card.update(anchor, { kind: 'rating', rating }));
        },
        leave: () => card.hide(anchor),
      });
    },
    afterBatch() {},
    stop() {},
  };
}

/** Answers the popup's `getStats` request from the content script. */
export function createContentMessageHandler(app: ContentApp, runtimeId: string): MessageHandler {
  return (message, sender) =>
    sender.id === runtimeId && isContentRequest(message) ? Promise.resolve(app.stats()) : undefined;
}
