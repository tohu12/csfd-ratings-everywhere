import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TitleQuery } from '@/lib/csfd-search';
import { OWN_ATTR } from '@/lib/linkify';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { findSite } from '@/lib/vod/detect';
import { startVodApp, VOD_LOOKUP_LIMIT, type VodDeps } from '@/lib/vod-app';
import { fakeMutationObserver, manualTimers } from '../helpers/fakes';
import { fixture } from '../helpers/fixtures';

const OK = { status: 'ok', percent: 78, count: 5, title: 'Není úniku' } as const;
const FILM_URL = 'https://www.netflix.com/browse/genre/34399?jbv=814862';
const badgeSel = `[${OWN_ATTR}="badge"]`;

/** Puts a captured VOD page into the test document (title + body). */
function loadVodPage(name: string): void {
  const parsed = new DOMParser().parseFromString(fixture(`pages/vod/${name}.html`), 'text/html');
  document.title = parsed.title;
  document.body.replaceChildren(
    ...[...parsed.body.childNodes].map((n) => document.importNode(n, true)),
  );
}

/** A Netflix detail modal for any title, built like the real one. */
function netflixModal(title: string, year: number): string {
  return (
    '<div class="previewModal--wrapper detail-modal"><div class="videoMetadata--container">' +
    `<div class="videoMetadata--line"><div class="year">${year}</div><span class="duration">1 h 40 m</span></div></div>` +
    `<div class="about-header"><h3>O pořadu <strong>${title}</strong></h3></div></div>`
  );
}

describe('startVodApp', () => {
  let timers: ReturnType<typeof manualTimers>;
  let mutations: ReturnType<typeof fakeMutationObserver>;
  let findTitle: ReturnType<typeof vi.fn<(query: TitleQuery) => Promise<unknown>>>;
  let visible: boolean;
  let url: string;

  const netflix = findSite('www.netflix.com');
  const start = (settings: Partial<Settings> = {}, extra: Partial<VodDeps> = {}) => {
    if (!netflix) {
      throw new Error('Netflix profile missing');
    }
    return startVodApp({
      doc: document,
      url: () => url,
      site: netflix,
      hostname: 'www.netflix.com',
      settings: { ...DEFAULT_SETTINGS, ...settings },
      t: (key, ...subs) => [key, ...subs].join('|'),
      formatCount: String,
      findTitle,
      isVisible: () => visible,
      createMutationObserver: mutations.create,
      setTimer: timers.set,
      ...extra,
    });
  };
  const badge = () => document.querySelector(badgeSel);
  const pill = () => badge()?.shadowRoot?.querySelector('a');
  const settle = () => vi.waitFor(() => expect(pill()?.className).not.toContain('loading'));
  /** The page changed: the observer fires and the throttled check runs. */
  const mutate = () => {
    mutations.add(document.body);
    timers.runAll();
  };

  beforeEach(() => {
    timers = manualTimers();
    mutations = fakeMutationObserver();
    findTitle = vi.fn(async () => ({ status: 'found', id: 42, rating: OK }));
    visible = true;
    url = FILM_URL;
    loadVodPage('netflix-film');
  });

  it('shows the rating next to the year of the open detail view', async () => {
    start();
    expect(findTitle).toHaveBeenCalledWith({ titles: ['Není úniku'], year: 1993, kind: 'film' });
    expect(badge()?.previousElementSibling?.className).toBe('year');
    expect(pill()?.className).toContain('loading');
    await settle();
    expect(pill()?.textContent).toBe('78 %');
    expect(pill()?.href).toBe('https://www.csfd.cz/film/42/prehled/');
  });

  it('shows "ČSFD ?" linking to the ČSFD search when the match is unsure', async () => {
    findTitle.mockResolvedValue({ status: 'unsure' });
    start();
    await settle();
    expect(pill()?.textContent).toBe('ČSFD ?');
    expect(pill()?.href).toBe('https://www.csfd.cz/hledat/?q=Nen%C3%AD%20%C3%BAniku');
  });

  it.each([
    [{ status: 'blocked' }, 'ČSFD !'],
    [{ status: 'error' }, 'ČSFD'],
    [{ status: 'nonsense' }, 'ČSFD'],
  ])('renders %j from the background as "%s"', async (answer, text) => {
    findTitle.mockResolvedValue(answer);
    start();
    await settle();
    expect(pill()?.textContent).toBe(text);
  });

  it('renders error when messaging fails', async () => {
    findTitle.mockRejectedValue(new Error('Extension context invalidated'));
    start();
    await settle();
    expect(pill()?.title).toBe('badgeError');
  });

  it('only links to the ČSFD search when ratings are turned off', () => {
    start({ showRatings: false });
    expect(findTitle).not.toHaveBeenCalled();
    expect(pill()?.title).toBe('badgeOpen');
    expect(pill()?.href).toContain('/hledat/?q=');
  });

  it('does nothing on a disabled site', () => {
    const app = start({ disabledHosts: ['netflix.com'] });
    expect(badge()).toBeNull();
    expect(mutations.observer.observe).not.toHaveBeenCalled();
    app.stop();
  });

  it('waits for a detail view to open, then shows its badge', () => {
    document.body.replaceChildren();
    start();
    expect(badge()).toBeNull();
    expect(findTitle).not.toHaveBeenCalled();
    document.body.insertAdjacentHTML('beforeend', netflixModal('Duna', 2021));
    document.title = 'Duna – Netflix';
    mutate();
    expect(findTitle).toHaveBeenCalledWith({ titles: ['Duna'], year: 2021, kind: 'film' });
    expect(badge()).not.toBeNull();
  });

  it('throttles checks: many mutations schedule one check', () => {
    start();
    mutations.add(document.body);
    mutations.add(document.body);
    expect(timers.pending).toEqual([300]);
  });

  it('removes the badge when the detail closes and reuses the answer when it reopens', async () => {
    start();
    await settle();
    const modal = document.querySelector('.previewModal--wrapper');
    modal?.remove();
    mutate();
    expect(badge()).toBeNull();
    if (modal) {
      document.body.append(modal);
    }
    mutate();
    await settle();
    expect(pill()?.textContent).toBe('78 %');
    expect(findTitle).toHaveBeenCalledTimes(1);
  });

  it('keeps the badge while the same title stays open', () => {
    start();
    const first = badge();
    mutate();
    expect(badge()).toBe(first);
  });

  it('replaces the badge when another title opens, ignoring the late answer for the old one', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    findTitle.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
    start();
    document.body.innerHTML = netflixModal('Duna', 2021);
    mutate();
    expect(findTitle).toHaveBeenCalledTimes(2);
    await settle();
    resolveFirst({ status: 'unsure' });
    await Promise.resolve();
    expect(document.querySelectorAll(badgeSel)).toHaveLength(1);
    expect(pill()?.textContent).toBe('78 %');
  });

  it('floats the badge in the corner when the anchor is not visible', () => {
    visible = false;
    start();
    expect(badge()?.parentElement).toBe(document.body);
    expect(badge()?.getAttribute('style')).toContain('position:fixed');
  });

  it(`stops asking after ${VOD_LOOKUP_LIMIT} titles on one page and only links to the search`, () => {
    start();
    for (let i = 1; i <= VOD_LOOKUP_LIMIT; i++) {
      document.body.innerHTML = netflixModal(`Film ${i}`, 2000);
      mutate();
    }
    expect(findTitle).toHaveBeenCalledTimes(VOD_LOOKUP_LIMIT);
    expect(pill()?.title).toBe('badgeOpen');
  });

  it('observes the whole document, including the <title>', () => {
    start();
    expect(mutations.observer.observe).toHaveBeenCalledWith(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  it('stop disconnects the observer, removes the badge and ignores pending checks', () => {
    const app = start();
    mutations.add(document.body);
    app.stop();
    expect(mutations.observer.disconnect).toHaveBeenCalled();
    expect(badge()).toBeNull();
    timers.runAll();
    expect(badge()).toBeNull();
  });
});
