import { startWelcome } from '@/lib/onboarding';
import { browserTranslator } from '@/platform/i18n';

startWelcome({
  doc: document,
  t: browserTranslator(),
  uiLanguage: browser.i18n.getUILanguage(),
  openOptions: () => void browser.runtime.openOptionsPage(),
});
