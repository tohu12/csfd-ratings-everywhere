import { createContentMessageHandler, startContentApp } from '@/lib/content-app';
import type { BackgroundRequest } from '@/lib/messages';
import { toRuntimeListener } from '@/lib/runtime-listener';
import { loadSettings } from '@/lib/settings';
import { browserTranslator } from '@/platform/i18n';

export default defineContentScript({
  matches: ['<all_urls>'],
  // ČSFD itself already shows ratings; badging every link there would only flood csfd.cz.
  excludeMatches: ['*://*.csfd.cz/*', '*://*.csfd.sk/*'],
  runAt: 'document_idle',
  async main() {
    const settings = await loadSettings(browser.storage.sync);
    const numberFormat = new Intl.NumberFormat(browser.i18n.getUILanguage());
    const app = startContentApp({
      doc: document,
      hostname: location.hostname,
      settings,
      t: browserTranslator(),
      formatCount: (count) => numberFormat.format(count),
      requestRating: (id) =>
        browser.runtime.sendMessage({ type: 'getRating', id } satisfies BackgroundRequest),
      peekRating: (id) =>
        browser.runtime.sendMessage({ type: 'peekRating', id } satisfies BackgroundRequest),
      isUserEvent: (event) => event.isTrusted,
      createIntersectionObserver: (callback) =>
        new IntersectionObserver(callback, { rootMargin: '200px' }),
      scheduleIdle: (callback) => requestIdleCallback(callback, { timeout: 2000 }),
      createMutationObserver: (callback) => new MutationObserver(callback),
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      now: () => performance.now(),
    });
    browser.runtime.onMessage.addListener(
      toRuntimeListener(createContentMessageHandler(app, browser.runtime.id)),
    );
  },
});
