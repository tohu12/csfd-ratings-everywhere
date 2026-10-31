import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_LOAD_LIMIT,
  type ContentApp,
  type ContentDeps,
  createContentMessageHandler,
  HOVER_INTENT_MS,
  KEYBOARD_FOCUS_WINDOW_MS,
  startContentApp,
} from '@/lib/content-app';
import { OWN_ATTR } from '@/lib/linkify';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { loadPage } from '../helpers/dom';
import {
  fakeIntersectionObserver,
  fakeMutationObserver,
  manualIdle,
  manualTimers,
} from '../helpers/fakes';

const OK = { status: 'ok', percent: 78, count: 5, title: 'Film' };
const badgeSel = `[${OWN_ATTR}="badge"]`;

describe('startContentApp', () => {
  let idle: ReturnType<typeof manualIdle>;
  let timers: ReturnType<typeof manualTimers>;
  let io: ReturnType<typeof fakeIntersectionObserver>;
  let mutations: ReturnType<typeof fakeMutationObserver>;
  let requestRating: ReturnType<typeof vi.fn<(id: number) => Promise<unknown>>>;
  let peekRating: ReturnType<typeof vi.fn<(id: number) => Promise<unknown>>>;
  let trusted: boolean;
  let clock: number;

  const start = (settings: Partial<Settings> = {}, extra: Partial<ContentDeps> = {}) => {
    const app = startContentApp({
      doc: document,
      hostname: 'warcenter.cz',
      settings: { ...DEFAULT_SETTINGS, ...settings },
      t: (key, ...subs) => [key, ...subs].join('|'),
      formatCount: String,
      requestRating,
      peekRating,
      isUserEvent: () => trusted,
      createIntersectionObserver: io.create,
      scheduleIdle: idle.schedule,
      createMutationObserver: mutations.create,
      setTimer: timers.set,
      clearTimer: timers.clear,
      now: () => clock,
      ...extra,
    });
    idle.runAll();
    return app;
  };

  const ext = () => document.getElementById('ext') as HTMLAnchorElement;
  const badgeOf = (anchor: Element) => anchor.nextElementSibling as HTMLElement;
  const pill = (host: Element) => host.shadowRoot?.querySelector('a') as HTMLAnchorElement;
  /** Real keyboard focus: a key press right before the focus event. */
  const tabTo = (el: Element) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    el.dispatchEvent(new FocusEvent('focus'));
  };
  const hover = (el: Element) => {
    el.dispatchEvent(new MouseEvent('mouseenter'));
    timers.runAll();
  };

  beforeEach(() => {
    idle = manualIdle();
    timers = manualTimers();
    io = fakeIntersectionObserver();
    mutations = fakeMutationObserver();
    requestRating = vi.fn(async () => OK);
    peekRating = vi.fn(async () => null);
    trusted = true;
    clock = 10_000;
    document.documentElement.querySelector(`[${OWN_ATTR}="card"]`)?.remove();
    loadPage('warcenter-like.html');
  });

  describe('badge mode', () => {
    it('inserts an idle badge after every link without any request', () => {
      const app = start();
      expect(document.querySelectorAll(badgeSel)).toHaveLength(3);
      expect(badgeOf(ext()).getAttribute(OWN_ATTR)).toBe('badge');
      expect(pill(badgeOf(ext())).title).toBe('badgeIdle');
      expect(pill(badgeOf(ext())).href).toBe('https://www.csfd.cz/film/1773198/prehled/');
      expect(app.stats()).toEqual({ links: 3 });
      expect(requestRating).not.toHaveBeenCalled();
      expect(peekRating).not.toHaveBeenCalled();
    });

    it('shows cached ratings once visible and fetches only the uncached films', async () => {
      peekRating.mockImplementation(async (id) => (id === 1773198 ? OK : null));
      start();
      io.show(badgeOf(ext()), false);
      expect(peekRating).not.toHaveBeenCalled();
      io.showAll();
      await vi.waitFor(() => expect(pill(badgeOf(ext())).textContent).toBe('78 %'));
      expect(peekRating).toHaveBeenCalledTimes(3);
      await vi.waitFor(() => expect(requestRating).toHaveBeenCalledTimes(2));
      expect(requestRating).not.toHaveBeenCalledWith(1773198);
      expect(io.observed.size).toBe(0);
      io.show(badgeOf(ext())); // already handled → ignored
      io.show(document.body); // unknown element → ignored
      expect(peekRating).toHaveBeenCalledTimes(3);
    });

    it('ignores invalid or failed peeks', async () => {
      peekRating.mockResolvedValueOnce({ status: 'hacked' });
      peekRating.mockRejectedValueOnce(new Error('context invalidated'));
      start();
      io.showAll();
      await vi.waitFor(() => expect(peekRating).toHaveBeenCalledTimes(3));
      expect(pill(badgeOf(ext())).title).toBe('badgeIdle');
    });

    describe(`automatic loading (first ${AUTO_LOAD_LIMIT} films)`, () => {
      const texts = () => [...document.querySelectorAll(badgeSel)].map((b) => pill(b).textContent);

      it('fetches uncached ratings as soon as badges are visible', async () => {
        start();
        expect(requestRating).not.toHaveBeenCalled();
        io.showAll();
        await vi.waitFor(() => expect(texts()).toEqual(['78 %', '78 %', '78 %']));
        expect(requestRating.mock.calls.map(([id]) => id).sort()).toEqual([1700849, 1773198, 6]);
      });

      it('prefers the cache and never fetches what it already knows', async () => {
        peekRating.mockResolvedValue({ status: 'none', title: 'X' });
        start();
        io.showAll();
        await vi.waitFor(() => expect(texts()).toEqual(['– %', '– %', '– %']));
        expect(requestRating).not.toHaveBeenCalled();
      });

      it('makes one request for 100 links to the same film', async () => {
        document.body.innerHTML = Array.from(
          { length: 100 },
          () => '<p>https://www.csfd.cz/film/1664550-pobuda/</p>',
        ).join('');
        start();
        io.showAll();
        await vi.waitFor(() => expect(texts().every((t) => t === '78 %')).toBe(true));
        expect(texts()).toHaveLength(100);
        expect(requestRating).toHaveBeenCalledTimes(1);
        expect(peekRating).toHaveBeenCalledTimes(1);
      });

      it(`loads at most ${AUTO_LOAD_LIMIT} distinct films per page; the rest on hover`, async () => {
        document.body.innerHTML = Array.from(
          { length: AUTO_LOAD_LIMIT + 5 },
          (_, i) => `<p>csfd.cz/film/${i + 1}</p><p>csfd.cz/film/${i + 1}</p>`,
        ).join('');
        start();
        io.showAll();
        await vi.waitFor(() => expect(requestRating).toHaveBeenCalledTimes(AUTO_LOAD_LIMIT));
        const last = [...document.querySelectorAll(badgeSel)].at(-1) as HTMLElement;
        expect(pill(last).title).toBe('badgeIdle');
        hover(last);
        await vi.waitFor(() => expect(pill(last).textContent).toBe('78 %'));
        expect(requestRating).toHaveBeenCalledTimes(AUTO_LOAD_LIMIT + 1);
      });

      it('stays idle after an automatic error (hover retries) but shows blocked', async () => {
        requestRating.mockResolvedValueOnce({ status: 'error' });
        requestRating.mockResolvedValueOnce({ status: 'blocked' });
        start();
        const badges = [...document.querySelectorAll(badgeSel)] as HTMLElement[];
        io.show(badges[0] as Element);
        await vi.waitFor(() => expect(requestRating).toHaveBeenCalledTimes(1));
        await vi.waitFor(() => expect(pill(badges[0] as Element).title).toBe('badgeIdle'));
        io.show(badges[1] as Element);
        await vi.waitFor(() => expect(pill(badges[1] as Element).title).toBe('badgeBlocked'));
        hover(badges[0] as Element);
        await vi.waitFor(() => expect(pill(badges[0] as Element).textContent).toBe('78 %'));
      });

      const repeatedFilm = (count: number, id: number) => {
        document.body.innerHTML = Array.from(
          { length: count },
          () => `<p>https://www.csfd.cz/film/${id}-x/</p>`,
        ).join('');
        start();
        return [...document.querySelectorAll(badgeSel)] as HTMLElement[];
      };

      it('tries a film automatically only once, even when links appear one by one and it fails', async () => {
        requestRating.mockResolvedValue({ status: 'error' });
        const badges = repeatedFilm(5, 42);
        for (const badge of badges) {
          io.show(badge);
          await vi.waitFor(() => expect(pill(badge).title).toBe('badgeIdle'));
        }
        expect(requestRating).toHaveBeenCalledTimes(1);
        expect(peekRating).toHaveBeenCalledTimes(1);
      });

      it('lets a link that appears during a running load join it', async () => {
        let finish: (value: unknown) => void = () => {};
        requestRating.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
        const [first, second] = repeatedFilm(2, 42) as [HTMLElement, HTMLElement];
        io.show(first);
        await vi.waitFor(() => expect(pill(first).title).toBe('badgeLoading'));
        io.show(second);
        await vi.waitFor(() => expect(pill(second).title).toBe('badgeLoading'));
        finish(OK);
        await vi.waitFor(() => expect(pill(second).textContent).toBe('78 %'));
        expect(pill(first).textContent).toBe('78 %');
        expect(requestRating).toHaveBeenCalledTimes(1);
        expect(peekRating).toHaveBeenCalledTimes(1);
      });

      it('peeks the cache once per film even beyond the limit', async () => {
        document.body.innerHTML = [
          ...Array.from({ length: AUTO_LOAD_LIMIT }, (_, i) => `<p>csfd.cz/film/${i + 1}</p>`),
          ...Array.from({ length: 30 }, () => '<p>csfd.cz/film/999</p>'),
        ].join('');
        start();
        for (const badge of document.querySelectorAll(badgeSel)) {
          io.show(badge);
        }
        await vi.waitFor(() => expect(requestRating).toHaveBeenCalledTimes(AUTO_LOAD_LIMIT));
        expect(peekRating.mock.calls.filter(([id]) => id === 999)).toHaveLength(1);
        expect(requestRating).not.toHaveBeenCalledWith(999);
      });

      it('uses a rating that finished loading while the cache lookup was still pending', async () => {
        let answerPeek: (value: unknown) => void = () => {};
        peekRating.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              answerPeek = resolve;
            }),
        );
        const [first, second] = repeatedFilm(2, 42) as [HTMLElement, HTMLElement];
        io.show(second); // cache lookup pending…
        hover(first); // …while a hover loads the film
        await vi.waitFor(() => expect(pill(first).textContent).toBe('78 %'));
        answerPeek(null);
        await vi.waitFor(() => expect(pill(second).textContent).toBe('78 %'));
        expect(requestRating).toHaveBeenCalledTimes(1);
      });

      it('answers a hover made during an automatic load, even if that load fails', async () => {
        let finish: (value: unknown) => void = () => {};
        requestRating.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
        start();
        const badge = badgeOf(ext());
        io.show(badge);
        await vi.waitFor(() => expect(pill(badge).title).toBe('badgeLoading'));
        hover(ext());
        hover(ext()); // still loading: nothing new
        finish({ status: 'error' });
        await vi.waitFor(() => expect(pill(badge).title).toBe('badgeError'));
        expect(requestRating).toHaveBeenCalledTimes(1);
      });

      it('ignores a late cache answer once a hover already started loading', async () => {
        let answerPeek: (value: unknown) => void = () => {};
        peekRating.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              answerPeek = resolve;
            }),
        );
        start();
        const badge = badgeOf(ext());
        io.show(badge);
        hover(ext());
        answerPeek({ status: 'none', title: 'stale' });
        await vi.waitFor(() => expect(pill(badge).textContent).toBe('78 %'));
        expect(requestRating).toHaveBeenCalledTimes(1);
      });
    });

    it('fetches after a real hover rests for the intent delay', async () => {
      start();
      ext().dispatchEvent(new MouseEvent('mouseenter'));
      expect(timers.pending).toEqual([HOVER_INTENT_MS]);
      expect(requestRating).not.toHaveBeenCalled();
      timers.runAll();
      expect(pill(badgeOf(ext())).title).toBe('badgeLoading');
      await vi.waitFor(() => expect(pill(badgeOf(ext())).textContent).toBe('78 %'));
      expect(requestRating).toHaveBeenCalledWith(1773198);
    });

    it('does not fetch when the mouse leaves before the intent delay', () => {
      start();
      ext().dispatchEvent(new MouseEvent('mouseenter'));
      ext().dispatchEvent(new MouseEvent('mouseleave'));
      expect(timers.pending).toEqual([]);
      ext().dispatchEvent(new MouseEvent('mouseleave')); // nothing to cancel
      expect(requestRating).not.toHaveBeenCalled();
    });

    it('restarts the intent delay on a repeated mouseenter', () => {
      start();
      ext().dispatchEvent(new MouseEvent('mouseenter'));
      ext().dispatchEvent(new MouseEvent('mouseenter'));
      expect(timers.pending).toEqual([HOVER_INTENT_MS]);
    });

    it('fetches immediately on keyboard focus and via the badge itself', async () => {
      start();
      tabTo(ext());
      expect(requestRating).toHaveBeenCalledTimes(1);
      const first = document.querySelector(badgeSel) as HTMLElement;
      hover(first);
      await vi.waitFor(() => expect(requestRating).toHaveBeenCalledTimes(2));
    });

    it('ignores focus that was not preceded by a real key press (script .focus())', () => {
      start();
      ext().dispatchEvent(new FocusEvent('focus'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      clock += KEYBOARD_FOCUS_WINDOW_MS + 1;
      ext().dispatchEvent(new FocusEvent('focus'));
      expect(requestRating).not.toHaveBeenCalled();
      clock -= 1;
      ext().dispatchEvent(new FocusEvent('focus'));
      expect(requestRating).toHaveBeenCalledTimes(1);
    });

    it('ignores synthetic events from page scripts', () => {
      trusted = false;
      start();
      ext().dispatchEvent(new MouseEvent('mouseenter'));
      tabTo(ext());
      expect(timers.pending).toEqual([]);
      expect(requestRating).not.toHaveBeenCalled();
    });

    it('fetches a film once, but retries after a transient failure', async () => {
      requestRating.mockResolvedValueOnce({ status: 'blocked' });
      requestRating.mockRejectedValueOnce(new Error('context invalidated'));
      start();
      const badge = badgeOf(ext());
      hover(ext());
      await vi.waitFor(() => expect(pill(badge).title).toBe('badgeBlocked'));
      hover(ext());
      await vi.waitFor(() => expect(pill(badge).title).toBe('badgeError'));
      hover(ext());
      await vi.waitFor(() => expect(pill(badge).textContent).toBe('78 %'));
      hover(ext());
      expect(requestRating).toHaveBeenCalledTimes(3);
    });

    it('shares one request for links to the same film', async () => {
      document.body.append(' a znovu csfd.cz/film/1773198-poberta');
      start();
      const links = [...document.querySelectorAll('a')].filter((a) => a.href.includes('1773198'));
      expect(links).toHaveLength(2);
      for (const link of links) {
        tabTo(link);
      }
      await vi.waitFor(() => expect(pill(badgeOf(links[1] as Element)).textContent).toBe('78 %'));
      expect(requestRating).toHaveBeenCalledTimes(1);
      // A later link to a film already known on this page needs neither network nor cache.
      document.body.append(' csfd.cz/film/1773198');
      const extra = document.body.lastChild as Text;
      mutations.add(extra);
      timers.runAll();
      idle.runAll();
      io.showAll();
      await vi.waitFor(() =>
        expect([...document.querySelectorAll(badgeSel)].map((b) => pill(b).textContent)).toContain(
          '78 %',
        ),
      );
      expect(peekRating).not.toHaveBeenCalledWith(1773198);
    });

    it('shows error for an invalid answer', async () => {
      requestRating.mockResolvedValueOnce({ status: 'ok', percent: 'hacked' });
      start();
      tabTo(ext());
      await vi.waitFor(() => expect(pill(badgeOf(ext())).title).toBe('badgeError'));
    });

    it('releases badges that were removed before ever becoming visible', () => {
      start();
      const badge = badgeOf(ext());
      document.getElementById('existing')?.remove();
      const p = document.createElement('p');
      p.textContent = 'csfd.cz/film/99';
      document.body.append(p);
      mutations.add(p);
      timers.runAll();
      idle.runAll();
      expect(io.observer.unobserve).toHaveBeenCalledWith(badge);
    });

    it('shows plain ČSFD links and never fetches when ratings are off', () => {
      start({ showRatings: false });
      expect(pill(badgeOf(ext())).title).toBe('badgeOpen');
      hover(ext());
      expect(io.observer.observe).not.toHaveBeenCalled();
      expect(requestRating).not.toHaveBeenCalled();
    });

    it('stop disconnects observers and listeners', () => {
      const app = start();
      app.stop();
      expect(io.observer.disconnect).toHaveBeenCalled();
      hover(ext());
      expect(requestRating).not.toHaveBeenCalled();
    });
  });

  describe('tooltip mode', () => {
    const card = () => document.querySelector<HTMLElement>(`[${OWN_ATTR}="card"]`);
    const cardTexts = () =>
      [...(card()?.shadowRoot?.querySelectorAll('.card span') ?? [])].map((s) => s.textContent);

    it('inserts nothing next to links but still linkifies text', () => {
      start({ display: 'tooltip' });
      expect(document.querySelectorAll(badgeSel)).toHaveLength(0);
      expect(document.querySelectorAll(`a[${OWN_ATTR}="link"]`)).toHaveLength(2);
      expect(card()).toBeNull();
    });

    it('shows a card with the rating after hover intent and hides it on leave', async () => {
      start({ display: 'tooltip' });
      hover(ext());
      expect(card()?.hidden).toBe(false);
      await vi.waitFor(() =>
        expect(cardTexts()).toEqual(['78 %', 'badgeRatingWithCount|Film|78|5']),
      );
      ext().dispatchEvent(new MouseEvent('mouseleave'));
      expect(card()?.hidden).toBe(true);
    });

    it('reuses a known rating on the next hover without another request', async () => {
      start({ display: 'tooltip' });
      hover(ext());
      await vi.waitFor(() => expect(cardTexts()[0]).toBe('78 %'));
      ext().dispatchEvent(new MouseEvent('mouseleave'));
      hover(ext());
      await vi.waitFor(() => expect(cardTexts()[0]).toBe('78 %'));
      expect(requestRating).toHaveBeenCalledTimes(1);
    });

    it('works with keyboard focus; links only when ratings are off', () => {
      start({ display: 'tooltip', showRatings: false });
      tabTo(ext());
      expect(cardTexts()).toEqual(['ČSFD', 'badgeOpen']);
      ext().dispatchEvent(new FocusEvent('blur'));
      expect(card()?.hidden).toBe(true);
      expect(requestRating).not.toHaveBeenCalled();
    });

    it('stop removes the listeners', () => {
      const app = start({ display: 'tooltip' });
      app.stop();
      hover(ext());
      expect(card()).toBeNull();
    });
  });

  it.each([
    ['disabled globally', { enabled: false }, 'warcenter.cz'],
    ['disabled for this host', { disabledHosts: ['warcenter.cz'] }, 'www.warcenter.cz'],
  ])('does nothing when %s', (_, settings, hostname) => {
    const app = start(settings, { hostname });
    expect(app.stats()).toEqual({ links: 0 });
    expect(document.querySelector(`[${OWN_ATTR}]`)).toBeNull();
    app.stop();
  });

  it('does nothing on documents without a body', () => {
    const doc = document.implementation.createDocument(null, 'svg', null);
    expect(start({}, { doc }).stats()).toEqual({ links: 0 });
  });
});

describe('createContentMessageHandler', () => {
  const app: ContentApp = { stats: () => ({ links: 4 }), stop: () => {} };
  const handle = createContentMessageHandler(app, 'self');

  it('answers getStats from our extension only', async () => {
    await expect(handle({ type: 'getStats' }, { id: 'self' })).resolves.toEqual({ links: 4 });
    expect(handle({ type: 'getStats' }, { id: 'evil' })).toBeUndefined();
    expect(handle({ type: 'getRating', id: 1 }, { id: 'self' })).toBeUndefined();
  });
});
