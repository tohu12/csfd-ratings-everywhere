import type { Translate } from './i18n';
import { OWN_ATTR } from './linkify';
import { type Rating, ratingColor } from './rating';

export type BadgeState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'link' }
  /** A VOD title without one certain ČSFD match; links to the ČSFD search. */
  | { kind: 'unsure' }
  | { kind: 'rating'; rating: Rating };

export interface Badge {
  /** Inserted into the page; carries OWN_ATTR. */
  readonly host: HTMLSpanElement;
  /** The link inside the shadow root. */
  readonly link: HTMLAnchorElement;
  render(state: BadgeState): void;
}

export interface BadgeOptions {
  t: Translate;
  formatCount: (count: number) => string;
}

/** Pill colours shared by the inline badge and the hover card. */
export const PILL_CSS = `
.pill{display:inline-block;padding:0 .5em;border-radius:1em;font:600 11px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:#6b6b6b;white-space:nowrap}
.good{background:#ba0305}
.average{background:#4a7ab0}
.bad{background:#535353}
.none{background:#b9b9b9;color:#222}
.loading{animation:p 1.2s ease-in-out infinite}
@keyframes p{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.loading{animation:none}}
`;

const STYLE = `${PILL_CSS}
:host{all:initial;display:inline}
a{margin-left:.35em;text-decoration:none;vertical-align:baseline;cursor:pointer}
a:hover{filter:brightness(1.1)}
a:focus-visible{outline:2px solid #1a73e8;outline-offset:1px}
`;

export interface BadgeView {
  text: string;
  className: string;
  title: string;
}

/** A self-contained rating badge. Page CSS cannot reach it and its CSS never leaks out. */
export function createBadge(doc: Document, href: string, options: BadgeOptions): Badge {
  const host = doc.createElement('span');
  host.setAttribute(OWN_ATTR, 'badge');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  const link = doc.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  shadow.append(style, link);

  return {
    host,
    link,
    render(state) {
      const view = describeBadge(state, options);
      link.textContent = view.text;
      link.className = `pill ${view.className}`.trim();
      link.title = view.title;
      link.setAttribute('aria-label', view.title);
    },
  };
}

/** Text, colour class and accessible description for a badge state. */
export function describeBadge(state: BadgeState, { t, formatCount }: BadgeOptions): BadgeView {
  if (state.kind === 'idle') {
    return { text: 'ČSFD', className: '', title: t('badgeIdle') };
  }
  if (state.kind === 'loading') {
    return { text: 'ČSFD', className: 'loading', title: t('badgeLoading') };
  }
  if (state.kind === 'link') {
    return { text: 'ČSFD', className: '', title: t('badgeOpen') };
  }
  if (state.kind === 'unsure') {
    return { text: 'ČSFD ?', className: '', title: t('badgeUnsure') };
  }
  const { rating } = state;
  switch (rating.status) {
    case 'ok': {
      const title = rating.title ?? t('untitled');
      const percent = String(rating.percent);
      return {
        text: `${percent} %`,
        className: ratingColor(rating.percent),
        title:
          rating.count === null
            ? t('badgeRating', title, percent)
            : t('badgeRatingWithCount', title, percent, formatCount(rating.count)),
      };
    }
    case 'none':
      return { text: '– %', className: 'none', title: t('badgeNone') };
    case 'blocked':
      return { text: 'ČSFD !', className: '', title: t('badgeBlocked') };
    case 'error':
      return { text: 'ČSFD', className: '', title: t('badgeError') };
  }
}
