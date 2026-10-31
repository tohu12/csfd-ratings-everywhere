import { describe, expect, it } from 'vitest';
import { type BadgeOptions, createBadge, describeBadge } from '@/lib/badge';
import { OWN_ATTR } from '@/lib/linkify';

const options: BadgeOptions = {
  t: (key, ...subs) => [key, ...subs].join('|'),
  formatCount: (n) => `${n}#`,
};

describe('describeBadge', () => {
  it.each([
    [{ kind: 'loading' }, { text: 'ČSFD', className: 'loading', title: 'badgeLoading' }],
    [{ kind: 'link' }, { text: 'ČSFD', className: '', title: 'badgeOpen' }],
    [{ kind: 'unsure' }, { text: 'ČSFD ?', className: '', title: 'badgeUnsure' }],
    [
      { kind: 'rating', rating: { status: 'ok', percent: 78, count: 1234, title: 'Film' } },
      { text: '78 %', className: 'good', title: 'badgeRatingWithCount|Film|78|1234#' },
    ],
    [
      { kind: 'rating', rating: { status: 'ok', percent: 45, count: null, title: null } },
      { text: '45 %', className: 'average', title: 'badgeRating|untitled|45' },
    ],
    [
      { kind: 'rating', rating: { status: 'ok', percent: 10, count: null, title: 'B' } },
      { text: '10 %', className: 'bad', title: 'badgeRating|B|10' },
    ],
    [
      { kind: 'rating', rating: { status: 'none', title: null } },
      { text: '– %', className: 'none', title: 'badgeNone' },
    ],
    [
      { kind: 'rating', rating: { status: 'blocked' } },
      { text: 'ČSFD !', className: '', title: 'badgeBlocked' },
    ],
    [
      { kind: 'rating', rating: { status: 'error' } },
      { text: 'ČSFD', className: '', title: 'badgeError' },
    ],
  ] as const)('%j', (state, view) => {
    expect(describeBadge(state, options)).toEqual(view);
  });
});

describe('createBadge', () => {
  it('builds an isolated, marked host with a safe link', () => {
    const badge = createBadge(document, 'https://www.csfd.cz/film/1/', options);
    expect(badge.host.getAttribute(OWN_ATTR)).toBe('badge');
    expect(badge.host.shadowRoot?.querySelector('a')).toBe(badge.link);
    expect(badge.link.href).toBe('https://www.csfd.cz/film/1/');
    expect(badge.link.target).toBe('_blank');
    expect(badge.link.rel).toBe('noopener noreferrer');
  });

  it('renders state into text, class, title and aria-label', () => {
    const badge = createBadge(document, 'https://www.csfd.cz/film/1/', options);
    badge.render({
      kind: 'rating',
      rating: { status: 'ok', percent: 90, count: null, title: 'F' },
    });
    expect(badge.link.textContent).toBe('90 %');
    expect(badge.link.className).toBe('pill good');
    expect(badge.link.title).toBe('badgeRating|F|90');
    expect(badge.link.getAttribute('aria-label')).toBe('badgeRating|F|90');
    badge.render({ kind: 'link' });
    expect(badge.link.className).toBe('pill');
  });
});
