import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { loadExtensionPage, loadPage } from '../helpers/dom';
import { fixture } from '../helpers/fixtures';

/** Delivers a runtime message as our own extension would and returns the async answer. */
async function deliver(message: unknown, senderId = fakeBrowser.runtime.id): Promise<unknown> {
  let respond: (value: unknown) => void = () => {};
  const answer = new Promise((resolve) => {
    respond = resolve;
  });
  const results: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
    message,
    { id: senderId },
    respond,
  );
  return results.includes(true) ? answer : undefined;
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.resetModules();
  fakeBrowser.i18n.getMessage = vi.fn((key: string, subs?: string | string[]) =>
    [key, ...(Array.isArray(subs) ? subs : [])].join('|'),
  ) as typeof fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getUILanguage = () => 'cs';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('background entrypoint', () => {
  it('answers getRating via the real wiring and ignores foreign senders', async () => {
    const fetchMock = vi.fn(async () => new Response(fixture('csfd/film.html')));
    vi.stubGlobal('fetch', fetchMock);
    const { default: background } = await import('@/entrypoints/background');
    background.main();

    await expect(deliver({ type: 'getRating', id: 1700849 })).resolves.toMatchObject({
      status: 'ok',
      percent: 65,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://www.csfd.cz/film/1700849/prehled/', {
      credentials: 'include',
      redirect: 'follow',
    });
    await expect(deliver({ type: 'clearCache' }, 'evil')).resolves.toBeUndefined();
  });

  it('opens the welcome page on install', async () => {
    const create = vi.fn(async () => ({}));
    fakeBrowser.tabs.create = create as unknown as typeof fakeBrowser.tabs.create;
    const { default: background } = await import('@/entrypoints/background');
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as never);
    expect(create).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL('/welcome.html') });
  });

  it('spaces consecutive ČSFD requests with a real timer', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(fixture('csfd/film.html')));
    vi.stubGlobal('fetch', fetchMock);
    const { default: background } = await import('@/entrypoints/background');
    background.main();
    const first = deliver({ type: 'getRating', id: 1 });
    const second = deliver({ type: 'getRating', id: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await Promise.all([first, second]);
    vi.useRealTimers();
  });
});

describe('content entrypoint', () => {
  it('is registered for all sites except ČSFD itself', async () => {
    const { default: content } = await import('@/entrypoints/content/index');
    expect(content.matches).toEqual(['<all_urls>']);
    expect(content.excludeMatches).toEqual(['*://*.csfd.cz/*', '*://*.csfd.sk/*']);
  });

  it('decorates the page and answers getStats', async () => {
    loadPage('warcenter-like.html');
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) =>
      cb({ didTimeout: false, timeRemaining: () => 50 }),
    );
    const observed: Element[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(readonly callback: IntersectionObserverCallback) {}
        observe(el: Element) {
          observed.push(el);
          this.callback(
            [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const sent: unknown[] = [];
    fakeBrowser.runtime.sendMessage = vi.fn(async (message: unknown) => {
      sent.push(message);
      return { status: 'ok', percent: 90, count: 1000, title: 'F' };
    }) as typeof fakeBrowser.runtime.sendMessage;

    const { default: content } = await import('@/entrypoints/content/index');
    await content.main({} as never);

    expect(observed).toHaveLength(3);
    // Visible badges only peek into the cache; the network needs a real user action.
    expect(sent).toContainEqual({ type: 'peekRating', id: 1773198 });
    expect(sent).not.toContainEqual(expect.objectContaining({ type: 'getRating' }));

    // A trusted hover that leaves early exercises the real timer wiring; a trusted focus fetches.
    const link = document.getElementById('ext') as HTMLAnchorElement;
    const trusted = <T extends Event>(event: T): T => {
      Object.defineProperty(event, 'isTrusted', { value: true });
      return event;
    };
    link.dispatchEvent(trusted(new MouseEvent('mouseenter')));
    link.dispatchEvent(new MouseEvent('mouseleave'));
    link.dispatchEvent(new FocusEvent('focus')); // untrusted → ignored
    expect(sent).not.toContainEqual(expect.objectContaining({ type: 'getRating' }));
    link.dispatchEvent(trusted(new FocusEvent('focus'))); // trusted, but no key press → ignored
    expect(sent).not.toContainEqual(expect.objectContaining({ type: 'getRating' }));
    document.dispatchEvent(trusted(new KeyboardEvent('keydown', { key: 'Tab' })));
    link.dispatchEvent(trusted(new FocusEvent('focus')));
    expect(sent).toContainEqual({ type: 'getRating', id: 1773198 });
    await expect(deliver({ type: 'getStats' })).resolves.toEqual({ links: 3 });

    // Exercise the injected timer + mutation observer wiring with real DOM changes.
    vi.useFakeTimers();
    const p = document.createElement('p');
    p.textContent = 'csfd.cz/film/42';
    document.body.append(p);
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    await vi.waitFor(async () => expect(await deliver({ type: 'getStats' })).toEqual({ links: 4 }));
  });

  it('respects a disabled site', async () => {
    loadPage('warcenter-like.html');
    await fakeBrowser.storage.sync.set({
      settings: { ...DEFAULT_SETTINGS, disabledHosts: [location.hostname] },
    });
    const { default: content } = await import('@/entrypoints/content/index');
    await content.main({} as never);
    await expect(deliver({ type: 'getStats' })).resolves.toEqual({ links: 0 });
  });
});

describe('vod content entrypoint', () => {
  it('is registered for the curated VOD sites only', async () => {
    const { default: vod } = await import('@/entrypoints/vod.content/index');
    expect(vod.matches).toEqual([
      'https://*.netflix.com/*',
      'https://*.disneyplus.com/*',
      'https://*.hbomax.com/*',
      'https://*.tv.apple.com/*',
      'https://*.primevideo.com/*',
      'https://*.skyshowtime.com/*',
      'https://*.oneplay.cz/*',
      'https://*.ceskatelevize.cz/porady/*',
      'https://*.ceskatelevize.cz/ivysilani/*',
      'https://*.iprima.cz/filmy/*',
      'https://*.iprima.cz/serialy/*',
    ]);
  });

  it('does nothing on a host without a VOD profile', async () => {
    const send = vi.fn();
    fakeBrowser.runtime.sendMessage = send as typeof fakeBrowser.runtime.sendMessage;
    const { default: vod } = await import('@/entrypoints/vod.content/index');
    await vod.main({} as never);
    expect(send).not.toHaveBeenCalled();
  });

  it('looks up the open Netflix title and re-checks after page changes', async () => {
    const page = new DOMParser().parseFromString(
      fixture('pages/vod/netflix-film.html'),
      'text/html',
    );
    document.title = page.title;
    document.body.replaceChildren(document.importNode(page.body, true));
    vi.stubGlobal('location', new URL('https://www.netflix.com/browse?jbv=814862'));
    const sent: unknown[] = [];
    fakeBrowser.runtime.sendMessage = vi.fn(async (message: unknown) => {
      sent.push(message);
      return {
        status: 'found',
        id: 7,
        rating: { status: 'ok', percent: 81, count: 1200, title: 'F' },
      };
    }) as typeof fakeBrowser.runtime.sendMessage;

    vi.stubGlobal('navigator', { ...navigator, userActivation: { hasBeenActive: true } });
    let invalidate = () => {};
    const ctx = { onInvalidated: (cb: () => void) => (invalidate = cb) };
    const { default: vod } = await import('@/entrypoints/vod.content/index');
    vi.useFakeTimers();
    await vod.main(ctx as never);
    await vi.advanceTimersByTimeAsync(300); // the detection settles
    expect(sent).toEqual([{ type: 'findTitle', titles: ['Není úniku'], year: 1993, kind: 'film' }]);
    const badge = () => document.querySelector('[data-csfd-linker="badge"]');
    await vi.waitFor(() => expect(badge()?.shadowRoot?.textContent).toContain('81 %'));

    document.querySelector('.previewModal--wrapper')?.remove();
    await vi.advanceTimersByTimeAsync(300);
    expect(badge()).toBeNull();

    // An extension update invalidates the script: it stops observing the page.
    document.body.append(document.importNode(page.body, true));
    invalidate();
    await vi.advanceTimersByTimeAsync(600);
    vi.useRealTimers();
    expect(badge()).toBeNull();
  });
});

describe('popup entrypoint', () => {
  it('boots the popup with browser APIs', async () => {
    loadExtensionPage('popup');
    const query = vi.fn(async () => [{ id: 5, url: 'https://warcenter.cz/' }]);
    fakeBrowser.tabs.query = query as unknown as typeof fakeBrowser.tabs.query;
    fakeBrowser.tabs.sendMessage = vi.fn(async () => ({
      links: 2,
    })) as typeof fakeBrowser.tabs.sendMessage;
    const openOptionsPage = vi.fn(async () => {});
    fakeBrowser.runtime.openOptionsPage = openOptionsPage;

    await import('@/entrypoints/popup/main');
    await vi.waitFor(() => expect(document.getElementById('link-count')?.textContent).toBe('2'));
    expect(document.documentElement.lang).toBe('cs');
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(fakeBrowser.tabs.sendMessage).toHaveBeenCalledWith(5, { type: 'getStats' });
    document.getElementById('open-options')?.click();
    expect(openOptionsPage).toHaveBeenCalled();
  });
});

describe('welcome entrypoint', () => {
  it('boots the welcome page', async () => {
    loadExtensionPage('welcome');
    const openOptionsPage = vi.fn(async () => {});
    fakeBrowser.runtime.openOptionsPage = openOptionsPage;
    await import('@/entrypoints/welcome/main');
    expect(document.title).toBe('welcomeTitle');
    document.getElementById('open-options')?.click();
    expect(openOptionsPage).toHaveBeenCalled();
  });
});

describe('options entrypoint', () => {
  it('boots the options page and clears the cache via the background', async () => {
    loadExtensionPage('options');
    const sendMessage = vi.fn(async () => true);
    fakeBrowser.runtime.sendMessage = sendMessage as typeof fakeBrowser.runtime.sendMessage;

    await import('@/entrypoints/options/main');
    await vi.waitFor(() => expect(document.title).toBe('optionsTitle'));
    document.getElementById('clear-cache')?.click();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'clearCache' }));
  });
});
