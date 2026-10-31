import { type BadgeOptions, type BadgeState, describeBadge, PILL_CSS } from './badge';
import { OWN_ATTR } from './linkify';

export interface HoverCard {
  /** Shows the card next to `target` (replacing any other target). */
  show(target: Element, state: BadgeState): void;
  /** Re-renders only if `target` is still the one shown (late async answers are dropped). */
  update(target: Element, state: BadgeState): void;
  hide(target: Element): void;
}

const STYLE = `${PILL_CSS}
:host{all:initial;position:fixed;z-index:2147483647;pointer-events:none}
:host([hidden]){display:none}
.card{display:flex;align-items:center;gap:8px;max-width:320px;padding:6px 10px;border-radius:8px;background:#fff;color:#1f1f1f;box-shadow:0 4px 16px rgba(0,0,0,.18);font:12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){.card{background:#2b2b2b;color:#ececec}}
`;

const GAP = 6;
const MARGIN = 8;
const CARD_WIDTH = 320;

/**
 * One floating, shadow-DOM-isolated card for the whole page. Fixed-positioned and
 * non-interactive, so the page layout is never touched. Inserted lazily on first use.
 */
export function createHoverCard(doc: Document, options: BadgeOptions): HoverCard {
  let host: HTMLElement | null = null;
  let pill: HTMLSpanElement;
  let label: HTMLSpanElement;
  let current: Element | null = null;

  const ensureHost = (): HTMLElement => {
    if (host) {
      return host;
    }
    host = doc.createElement('div');
    host.setAttribute(OWN_ATTR, 'card');
    host.setAttribute('role', 'tooltip');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    const card = doc.createElement('div');
    card.className = 'card';
    pill = doc.createElement('span');
    label = doc.createElement('span');
    card.append(pill, label);
    shadow.append(style, card);
    doc.documentElement.append(host);
    return host;
  };

  const render = (state: BadgeState) => {
    const view = describeBadge(state, options);
    pill.textContent = view.text;
    pill.className = `pill ${view.className}`.trim();
    label.textContent = view.title;
  };

  /** Reads layout only (call before any DOM writes to avoid a forced synchronous layout). */
  const measure = (target: Element) => {
    const rect = target.getBoundingClientRect();
    const viewWidth = doc.documentElement.clientWidth;
    const below = rect.bottom + GAP + 40 <= doc.documentElement.clientHeight;
    return {
      left: `${Math.max(MARGIN, Math.min(rect.left, viewWidth - CARD_WIDTH - MARGIN))}px`,
      top: `${below ? rect.bottom + GAP : rect.top - GAP}px`,
      transform: below ? '' : 'translateY(-100%)',
    };
  };

  return {
    show(target, state) {
      const place = measure(target);
      const el = ensureHost();
      current = target;
      render(state);
      Object.assign(el.style, place);
      el.hidden = false;
    },
    update(target, state) {
      if (current === target) {
        render(state);
      }
    },
    hide(target) {
      if (host && current === target) {
        current = null;
        host.hidden = true;
      }
    },
  };
}
