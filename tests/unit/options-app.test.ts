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

  it('clears the cache through the background', async () => {
    await startOptions(deps);
    $('#clear-cache').click();
    await vi.waitFor(() => expect($('#status').textContent).toBe('T:optionsCacheCleared'));
    expect(deps.sendToBackground).toHaveBeenCalledWith({ type: 'clearCache' });
  });
});
