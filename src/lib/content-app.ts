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

export interface ContentDeps {
  doc: Document;
  hostname: string;
  settings: Settings;
  t: Translate;
  formatCount: (count: number) => string;
  /** `getRating`: may hit the network. Only ever called after a real user action. */
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
  /** Cache-only lookup; `null` when unknown. */
  peek(id: number): Promise<Rating | null>;
}

const INERT: ContentApp = { stats: () => ({ links: 0 }), stop: () => {} };

/**
 * Linkifies ČSFD URLs and shows ratings as badges or hover cards. Ratings are fetched only
 * after a real hover or keyboard focus; ratings already in the cache are shown right away.
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
    async peek(id) {
      const known = final.get(id);
      if (known) {
        return known;
      }
      const value = await deps.peekRating(id).catch(() => null);
      if (!isRating(value)) {
        return null;
      }
      remember(id, value);
      return value;
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

/** Inline pill after each link: cached ratings appear when visible, others on hover/focus. */
function badgeDecorator(
  doc: Document,
  options: BadgeOptions,
  showRatings: boolean,
  ratings: Ratings,
  intent: Intent,
  deps: ContentDeps,
): Decorator {
  const waiting = new Map<Element, { badge: Badge; id: number }>();
  const visibility = deps.createIntersectionObserver((entries) => {
    for (const entry of entries) {
      const pending = waiting.get(entry.target);
      if (entry.isIntersecting && pending) {
        forget(entry.target);
        void ratings.peek(pending.id).then((rating) => {
          if (rating) {
            pending.badge.render({ kind: 'rating', rating });
          }
        });
      }
    }
  });
  const forget = (host: Element) => {
    waiting.delete(host);
    visibility.unobserve(host);
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
      waiting.set(badge.host, { badge, id: link.id });
      visibility.observe(badge.host);
      let shown = false;
      intent([anchor, badge.host], {
        act: () => {
          if (shown) {
            return;
          }
          shown = true;
          forget(badge.host);
          badge.render({ kind: 'loading' });
          void ratings.load(link.id).then((rating) => {
            // Transient failures may be retried by the next hover.
            shown = rating.status === 'ok' || rating.status === 'none';
            badge.render({ kind: 'rating', rating });
          });
        },
        leave: () => {},
      });
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
