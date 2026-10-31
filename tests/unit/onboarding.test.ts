import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstallHandler, startWelcome, WELCOME_PATH } from '@/lib/onboarding';
import { loadExtensionPage } from '../helpers/dom';

describe('createInstallHandler', () => {
  it('opens the welcome page on a fresh install only', () => {
    const openTab = vi.fn();
    const handle = createInstallHandler(openTab, `chrome-extension://x${WELCOME_PATH}`);
    handle({ reason: 'update' });
    handle({ reason: 'browser_update' });
    expect(openTab).not.toHaveBeenCalled();
    handle({ reason: 'install' });
    expect(openTab).toHaveBeenCalledWith('chrome-extension://x/welcome.html');
  });
});

describe('startWelcome', () => {
  beforeEach(() => {
    loadExtensionPage('welcome');
  });

  it('localises the page and opens the settings', () => {
    const openOptions = vi.fn();
    startWelcome({ doc: document, t: (key) => `T:${key}`, uiLanguage: 'sk', openOptions });
    expect(document.title).toBe('T:welcomeTitle');
    expect(document.documentElement.lang).toBe('sk');
    expect(document.querySelector('h1')?.textContent).toBe('T:welcomeTitle');
    expect(document.querySelectorAll('.legend .pill')).toHaveLength(4);
    (document.getElementById('open-options') as HTMLButtonElement).click();
    expect(openOptions).toHaveBeenCalledOnce();
  });
});
