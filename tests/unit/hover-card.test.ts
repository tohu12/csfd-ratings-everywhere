import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgeOptions } from '@/lib/badge';
import { createHoverCard, type HoverCard } from '@/lib/hover-card';
import { OWN_ATTR } from '@/lib/linkify';

const options: BadgeOptions = { t: (key) => key, formatCount: String };
const OK = {
  kind: 'rating',
  rating: { status: 'ok', percent: 80, count: null, title: 'F' },
} as const;

function rect(top: number, left: number, height = 16): DOMRect {
  return {
    top,
    left,
    bottom: top + height,
    right: left + 100,
    width: 100,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe('createHoverCard', () => {
  let card: HoverCard;
  let a: HTMLAnchorElement;
  let b: HTMLAnchorElement;
  let shadow: ShadowRoot | undefined;

  const host = () => document.querySelector<HTMLElement>(`[${OWN_ATTR}="card"]`);

  beforeEach(() => {
    document.documentElement.querySelector(`[${OWN_ATTR}="card"]`)?.remove();
    document.body.textContent = '';
    a = document.createElement('a');
    b = document.createElement('a');
    document.body.append(a, b);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
    const attach = HTMLElement.prototype.attachShadow;
    vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (
      this: HTMLElement,
      init: ShadowRootInit,
    ) {
      shadow = attach.call(this, init);
      return shadow;
    });
    card = createHoverCard(document, options);
  });

  const shown = () => [...(shadow?.querySelectorAll('.card span') ?? [])].map((s) => s.textContent);

  it('is inserted lazily, once, as a marked tooltip', () => {
    expect(host()).toBeNull();
    card.show(a, { kind: 'loading' });
    card.show(b, { kind: 'loading' });
    expect(document.querySelectorAll(`[${OWN_ATTR}="card"]`)).toHaveLength(1);
    expect(host()?.getAttribute('role')).toBe('tooltip');
    expect(host()?.hidden).toBe(false);
  });

  it('positions below the target, clamped to the viewport', () => {
    vi.spyOn(a, 'getBoundingClientRect').mockReturnValue(rect(100, 900));
    card.show(a, { kind: 'loading' });
    expect(host()?.style.top).toBe('122px');
    expect(host()?.style.left).toBe(`${1000 - 320 - 8}px`);
    expect(host()?.style.transform).toBe('');
  });

  it('flips above the target near the bottom edge and clamps the left margin', () => {
    vi.spyOn(a, 'getBoundingClientRect').mockReturnValue(rect(780, -50));
    card.show(a, { kind: 'loading' });
    expect(host()?.style.top).toBe('774px');
    expect(host()?.style.left).toBe('8px');
    expect(host()?.style.transform).toBe('translateY(-100%)');
  });

  it('renders the state and drops late updates for other targets', () => {
    card.show(a, { kind: 'loading' });
    expect(shown()).toEqual(['ČSFD', 'badgeLoading']);
    card.update(b, OK);
    expect(shown()).toEqual(['ČSFD', 'badgeLoading']);
    card.update(a, OK);
    expect(shown()).toEqual(['80 %', 'badgeRating']);
    card.show(b, { kind: 'link' });
    card.update(a, { kind: 'loading' });
    expect(shown()).toEqual(['ČSFD', 'badgeOpen']);
  });

  it('hides only when the hidden target is the shown one', () => {
    card.show(a, { kind: 'loading' });
    card.hide(b);
    expect(host()?.hidden).toBe(false);
    card.hide(a);
    expect(host()?.hidden).toBe(true);
  });

  it('ignores hide before anything was shown', () => {
    card.hide(a);
    expect(host()).toBeNull();
  });
});
