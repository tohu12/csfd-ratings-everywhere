import { startPopup } from '@/lib/popup-app';
import { browserTranslator } from '@/platform/i18n';

void startPopup({
  doc: document,
  t: browserTranslator(),
  uiLanguage: browser.i18n.getUILanguage(),
  store: browser.storage.sync,
  getActiveTab: async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0],
  sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
  openOptions: () => void browser.runtime.openOptionsPage(),
  local: browser.storage.local,
  version: browser.runtime.getManifest().version,
});
