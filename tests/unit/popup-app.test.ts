import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PopupDeps, startPopup } from '@/lib/popup-app';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { loadExtensionPage } from '../helpers/dom';
import { type MemoryStore, memoryStore } from '../helpers/memory-store';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

describe('startPopup', () => {
  let store: MemoryStore;
  let deps: PopupDeps;

  beforeEach(() => {
    loadExtensionPage('popup');
    store = memoryStore();
    deps = {
      doc: document,
      t: (key) => `T:${key}`,
      uiLanguage: 'cs',
      store,
      getActiveTab: async () => ({ id: 7, url: 'https://www.warcenter.cz/viewtopic.php' }),
      sendToTab: vi.fn(async () => ({ links: 3 })),
      openOptions: vi.fn(),
    };
  });

  it('localises and shows state for the active site', async () => {
    await startPopup(deps);
    expect(document.documentElement.lang).toBe('cs');
    expect($('h1').textContent).toBe('T:extName');
    expect($('#site-name').textContent).toBe('www.warcenter.cz');
    expect($<HTMLInputElement>('#site-toggle').checked).toBe(true);
    expect($<HTMLInputElement>('#global-toggle').checked).toBe(true);
    expect($('#link-count').textContent).toBe('3');
    expect(deps.sendToTab).toHaveBeenCalledWith(7, { type: 'getStats' });
  });

  it('shows the site as on even while the global switch is off', async () => {
    store.data.set('settings', { ...DEFAULT_SETTINGS, enabled: false });
    await startPopup(deps);
    expect($<HTMLInputElement>('#site-toggle').checked).toBe(true);
    expect($<HTMLInputElement>('#global-toggle').checked).toBe(false);
  });

  it('toggling the site and the global switch saves settings', async () => {
    await startPopup(deps);
    const site = $<HTMLInputElement>('#site-toggle');
    site.checked = false;
    site.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(store.data.get('settings')).toMatchObject({ disabledHosts: ['warcenter.cz'] }),
    );
    const global = $<HTMLInputElement>('#global-toggle');
    global.checked = false;
    global.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(store.data.get('settings')).toMatchObject({
        enabled: false,
        disabledHosts: ['warcenter.cz'],
      }),
    );
  });

  it('opens the options page', async () => {
    await startPopup(deps);
    $('#open-options').click();
    expect(deps.openOptions).toHaveBeenCalled();
  });

  it.each([
    ['a browser page', { id: 1, url: 'chrome://extensions' }],
    ['no url', { id: 1 }],
    ['no tab', undefined],
  ])('disables the site switch on %s', async (_, tab) => {
    deps.getActiveTab = async () => tab;
    await startPopup(deps);
    expect($<HTMLInputElement>('#site-toggle').disabled).toBe(true);
    expect($('#site-name').textContent).toBe('T:popupSiteUnavailable');
    expect($('#link-count').textContent).toBe('–');
    expect(deps.sendToTab).not.toHaveBeenCalled();
  });

  it.each([
    'https://www.csfd.cz/film/1773198-poberta/prehled/',
    'https://m.csfd.cz/',
    'https://csfd.sk/film/1',
  ])('explains that nothing is needed on ČSFD itself (%s)', async (url) => {
    deps.getActiveTab = async () => ({ id: 3, url });
    $<HTMLInputElement>('#site-toggle').checked = true;
    await startPopup(deps);
    expect($<HTMLInputElement>('#site-toggle').disabled).toBe(true);
    expect($<HTMLInputElement>('#site-toggle').checked).toBe(false);
    expect($('#site-name').textContent).toBe('T:popupOnCsfd');
    expect($('#link-count').textContent).toBe('–');
    expect(deps.sendToTab).not.toHaveBeenCalled();
  });

  it.each([
    ['no content script answers', () => Promise.reject(new Error('no receiver'))],
    ['the answer is malformed', async () => ({ links: 'many' })],
  ])('shows a dash when %s', async (_, sendToTab) => {
    deps.sendToTab = sendToTab;
    await startPopup(deps);
    expect($('#link-count').textContent).toBe('–');
  });

  it('skips the stats request for a tab without id', async () => {
    deps.getActiveTab = async () => ({ url: 'https://a.cz/' });
    await startPopup(deps);
    expect(deps.sendToTab).not.toHaveBeenCalled();
  });
});
