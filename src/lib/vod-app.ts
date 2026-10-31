import { type Badge, type BadgeOptions, createBadge } from './badge';
import { lookupKey, searchUrl, type TitleQuery } from './csfd-search';
import { ratingUrl } from './csfd-url';
import type { Translate } from './i18n';
import { isTitleResult, type TitleResult } from './messages';
import { BLOCKED, ERROR } from './rating';
import { isHostEnabled, type Settings } from './settings';
import { type DetectedTitle, detectTitle, type VodSite } from './vod/detect';

export interface VodDeps {
  doc: Document;
  /** Current page URL (SPAs change it without reloading). */
  url: () => string;
  site: VodSite;
  hostname: string;
  settings: Settings;
  t: Translate;
  formatCount: (count: number) => string;
  /** Sends `findTitle` to the background; the answer is validated here. */
  findTitle: (query: TitleQuery) => Promise<unknown>;
  /** Whether an element is rendered with a size (false for visually hidden headings). */
  isVisible: (el: Element) => boolean;
  createMutationObserver: (callback: MutationCallback) => MutationObserver;
  setTimer: (callback: () => void, ms: number) => unknown;
}

export interface VodApp {
  stop(): void;
}

/** Safety net against a page that keeps switching titles: lookups per page load (SPEC §4b). */
export const VOD_LOOKUP_LIMIT = 30;
const CHECK_INTERVAL_MS = 300;
const MAX_TITLE_LENGTH = 200;
const FLOATING_STYLE = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
const ERROR_RESULT: TitleResult = { status: 'error' };

/**
 * Shows the ČSFD rating of the film or series whose detail view is open on a VOD site.
 * One badge at a time, next to the title (or floating in the corner); one lookup per title per page.
 */
export function startVodApp(deps: VodDeps): VodApp {
  const { doc, settings } = deps;
  if (!isHostEnabled(settings, deps.hostname)) {
    return { stop: () => {} };
  }
  const options: BadgeOptions = { t: deps.t, formatCount: deps.formatCount };
  const results = new Map<string, Promise<TitleResult>>();
  let current: { key: string; badge: Badge } | null = null;
  let scheduled = false;
  let stopped = false;

  const lookUp = (key: string, query: TitleQuery): Promise<TitleResult> | null => {
    const known = results.get(key);
    if (known || !settings.showRatings || results.size >= VOD_LOOKUP_LIMIT) {
      return known ?? null;
    }
    const result = deps.findTitle(query).then(
      (answer) => (isTitleResult(answer) ? answer : ERROR_RESULT),
      () => ERROR_RESULT,
    );
    results.set(key, result);
    return result;
  };

  const show = (detected: DetectedTitle): void => {
    const query: TitleQuery = {
      titles: detected.titles.slice(0, 2).map((t) => t.slice(0, MAX_TITLE_LENGTH)),
      year: detected.year,
      kind: detected.kind,
    };
    const key = lookupKey(query);
    if (current?.key === key && current.badge.host.isConnected) {
      return;
    }
    current?.badge.host.remove();
    const badge = createBadge(doc, searchUrl(detected.titles[0]), options);
    if (detected.anchor && deps.isVisible(detected.anchor)) {
      detected.anchor.after(badge.host);
    } else {
      badge.host.setAttribute('style', FLOATING_STYLE);
      doc.body.append(badge.host);
    }
    current = { key, badge };
    const result = lookUp(key, query);
    if (!result) {
      badge.render({ kind: 'link' });
      return;
    }
    badge.render({ kind: 'loading' });
    void result.then((answer) => {
      if (current?.badge === badge) {
        render(badge, answer);
      }
    });
  };

  const check = (): void => {
    scheduled = false;
    if (stopped) {
      return;
    }
    const detected = detectTitle(doc, new URL(deps.url()), deps.site);
    if (detected) {
      show(detected);
    } else {
      current?.badge.host.remove();
      current = null;
    }
  };

  const observer = deps.createMutationObserver(() => {
    // Throttle, not debounce: streaming pages mutate constantly and a debounce would never fire.
    if (!scheduled) {
      scheduled = true;
      deps.setTimer(check, CHECK_INTERVAL_MS);
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  check();

  return {
    stop() {
      stopped = true;
      observer.disconnect();
      current?.badge.host.remove();
      current = null;
    },
  };
}

function render(badge: Badge, answer: TitleResult): void {
  switch (answer.status) {
    case 'found':
      badge.link.href = ratingUrl(answer.id);
      badge.render({ kind: 'rating', rating: answer.rating });
      return;
    case 'unsure':
      badge.render({ kind: 'unsure' });
      return;
    case 'blocked':
      badge.render({ kind: 'rating', rating: BLOCKED });
      return;
    case 'error':
      badge.render({ kind: 'rating', rating: ERROR });
      return;
  }
}
