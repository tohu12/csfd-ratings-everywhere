import type { BackgroundRequest } from '@/lib/messages';
import { loadSettings } from '@/lib/settings';
import { findSite, VOD_SITES } from '@/lib/vod/detect';
import { startVodApp } from '@/lib/vod-app';
import { browserTranslator } from '@/platform/i18n';

export default defineContentScript({
  // Only the curated VOD sites (SPEC §4b), HTTPS only; `*.host` also matches the bare host.
  // Whole hosts: SPAs navigate into detail pages without a reload; `detailPath` filters at runtime.
  matches: VOD_SITES.map((site) => `https://*.${site.host}/*`),
  runAt: 'document_idle',
  async main(ctx) {
    const site = findSite(location.hostname);
    if (!site) {
      return;
    }
    const settings = await loadSettings(browser.storage.sync);
    const numberFormat = new Intl.NumberFormat(browser.i18n.getUILanguage());
    const app = startVodApp({
      doc: document,
      url: () => location.href,
      site,
      hostname: location.hostname,
      settings,
      t: browserTranslator(),
      formatCount: (count) => numberFormat.format(count),
      findTitle: (query) =>
        browser.runtime.sendMessage({ type: 'findTitle', ...query } satisfies BackgroundRequest),
      // Visually hidden headings are 1×1 px; those get the floating badge instead.
      isVisible: (el) => el.getBoundingClientRect().width > 1,
      // Sticky user activation: page scripts cannot fake it, and it resets on every page load.
      isUserActive: () => navigator.userActivation.hasBeenActive,
      createMutationObserver: (callback) => new MutationObserver(callback),
      setTimer: (callback, ms) => setTimeout(callback, ms),
    });
    // After an extension update the orphaned script must not keep observing a long-lived SPA tab.
    ctx.onInvalidated(() => app.stop());
  },
});
