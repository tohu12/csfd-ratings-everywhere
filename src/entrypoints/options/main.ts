import { startOptions } from '@/lib/options-app';
import { browserTranslator } from '@/platform/i18n';

void startOptions({
  doc: document,
  t: browserTranslator(),
  uiLanguage: browser.i18n.getUILanguage(),
  store: browser.storage.sync,
  sendToBackground: (message) => browser.runtime.sendMessage(message),
});
