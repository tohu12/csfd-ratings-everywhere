import { element } from './dom';
import { localizeDocument, type Translate } from './i18n';

export const WELCOME_PATH = '/welcome.html';

export interface InstallDetails {
  reason: string;
}

/** Opens the welcome page on a fresh install only (never on updates or browser updates). */
export function createInstallHandler(
  openTab: (url: string) => unknown,
  welcomeUrl: string,
): (details: InstallDetails) => void {
  return (details) => {
    if (details.reason === 'install') {
      void openTab(welcomeUrl);
    }
  };
}

export interface WelcomeDeps {
  doc: Document;
  t: Translate;
  uiLanguage: string;
  openOptions: () => void;
}

/** Welcome page: what the extension does, what the colours mean, where the settings are. */
export function startWelcome({ doc, t, uiLanguage, openOptions }: WelcomeDeps): void {
  localizeDocument(doc, t, uiLanguage);
  doc.title = t('welcomeTitle');
  element(doc, '#open-options', HTMLButtonElement).addEventListener('click', openOptions);
}
