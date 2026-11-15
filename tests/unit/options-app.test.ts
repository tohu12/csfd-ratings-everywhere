import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type OptionsDeps, startOptions } from '@/lib/options-app';
import { loadExtensionPage } from '../helpers/dom';
import { type MemoryStore, memoryStore } from '../helpers/memory-store';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

describe('startOptions', () => {
  let store: MemoryStore;
  let deps: OptionsDeps;

  beforeEach(() => {
    loadExtensionPage('options');
    store = memoryStore({
      settings: {
        enabled: true,
        showRatings: false,
        display: 'tooltip',
        disabledHosts: ['a.cz', 'b.cz'],
      },
    });
    deps = {
      doc: document,
      t: (key) => `T:${key}`,
      uiLanguage: 'sk',
      store,
      sendToBackground: vi.fn(async () => true),
    };
  });

  it('localises the page and shows stored settings', async () => {
    await startOptions(deps);
    expect(document.title).toBe('T:optionsTitle');
    expect(document.documentElement.lang).toBe('sk');
    expect($<HTMLInputElement>('#enabled').checked).toBe(true);
    expect($<HTMLInputElement>('#show-ratings').checked).toBe(false);
    expect($<HTMLSelectElement>('#display').value).toBe('tooltip');
    expect($<HTMLTextAreaElement>('#disabled-hosts').value).toBe('a.cz\nb.cz');
  });

  it('keeps the controls disabled until the stored settings are shown', async () => {
    const controls = ['#enabled', '#show-ratings', '#display', '#disabled-hosts'].map((sel) =>
      $<HTMLInputElement>(sel),
    );
    const started = startOptions(deps);
    // A change made before this point would be lost: the stored settings would overwrite it.
    expect(controls.map((c) => c.disabled)).toEqual([true, true, true, true]);
    await started;
    expect(controls.map((c) => c.disabled)).toEqual([false, false, false, false]);
  });

  const change = (selector: string, apply: (el: HTMLElement) => void) => {
    const el = $(selector);
    apply(el);
    el.dispatchEvent(new Event('change'));
  };
  const saved = async () => {
    await vi.waitFor(() => expect($('#status').textContent).toBe('T:optionsSaved'));
    return store.data.get('settings');
  };

  it.each([
    [
      '#enabled',
      (el: HTMLElement) => ((el as HTMLInputElement).checked = false),
      { enabled: false },
    ],
    [
      '#show-ratings',
      (el: HTMLElement) => ((el as HTMLInputElement).checked = true),
      { showRatings: true },
    ],
    [
      '#display',
      (el: HTMLElement) => ((el as HTMLSelectElement).value = 'badge'),
      { display: 'badge' },
    ],
  ])('saves only the changed field of %s', async (selector, apply, patch) => {
    await startOptions(deps);
    change(selector, apply);
    expect(await saved()).toEqual({
      enabled: true,
      showRatings: false,
      display: 'tooltip',
      disabledHosts: ['a.cz', 'b.cz'],
      ...patch,
    });
  });

  it('normalises the disabled hosts list', async () => {
    await startOptions(deps);
    change('#disabled-hosts', (el) => {
      (el as HTMLTextAreaElement).value = ' WWW.C.cz \n\n a.cz  x.cz';
    });
    expect(await saved()).toMatchObject({ disabledHosts: ['c.cz', 'a.cz', 'x.cz'] });
    expect($<HTMLTextAreaElement>('#disabled-hosts').value).toBe('c.cz\na.cz\nx.cz');
  });

  it('keeps changes made elsewhere (e.g. in the popup) while the page is open', async () => {
    await startOptions(deps);
    store.data.set('settings', {
      enabled: true,
      showRatings: false,
      display: 'tooltip',
      disabledHosts: ['a.cz', 'b.cz', 'popup.cz'],
    });
    change('#display', (el) => {
      (el as HTMLSelectElement).value = 'badge';
    });
    expect(await saved()).toMatchObject({
      display: 'badge',
      disabledHosts: ['a.cz', 'b.cz', 'popup.cz'],
    });
    expect($<HTMLTextAreaElement>('#disabled-hosts').value).toBe('a.cz\nb.cz\npopup.cz');
  });

  it('clears the cache through the background and shows that it is empty again', async () => {
    let stored = 42;
    const send = vi.fn(async (message: { type: string }) => {
      if (message.type === 'clearCache') {
        stored = 0;
        return true;
      }
      return message.type === 'cacheSize' ? stored : true;
    });
    deps.t = (key, ...subs) => `T:${key}(${subs.join(',')})`;
    deps.sendToBackground = send as OptionsDeps['sendToBackground'];
    await startOptions(deps);
    await vi.waitFor(() => expect($('#cache-size').textContent).toBe('T:optionsCacheSize(42)'));

    $('#clear-cache').click();
    await vi.waitFor(() => expect($('#status').textContent).toBe('T:optionsCacheCleared()'));
    expect(send).toHaveBeenCalledWith({ type: 'clearCache' });
    await vi.waitFor(() => expect($('#cache-size').textContent).toBe('T:optionsCacheSize(0)'));
  });

  it('shows how many entries are stored', async () => {
    const counts: string[] = [];
    deps.t = (key, ...subs) => `T:${key}(${subs.join(',')})`;
    deps.sendToBackground = vi.fn(async (message) =>
      message.type === 'cacheSize' ? 7 : true,
    ) as OptionsDeps['sendToBackground'];
    await startOptions(deps);
    await vi.waitFor(() => expect($('#cache-size').textContent).toBe('T:optionsCacheSize(7)'));
    counts.push($('#cache-size').textContent ?? '');
    expect(counts).toEqual(['T:optionsCacheSize(7)']);
  });

  it('says nothing about the cache when the background does not answer with a count', async () => {
    deps.sendToBackground = vi.fn(async () => undefined) as OptionsDeps['sendToBackground'];
    await startOptions(deps);
    expect($('#cache-size').textContent).toBe('');
  });
});
