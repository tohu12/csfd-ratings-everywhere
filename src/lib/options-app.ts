import { element } from './dom';
import { localizeDocument, type Translate } from './i18n';
import type { BackgroundRequest } from './messages';
import { loadSettings, normalizeSettings, type Settings, updateSettings } from './settings';
import type { KeyValueStore } from './store';

export interface OptionsDeps {
  doc: Document;
  t: Translate;
  uiLanguage: string;
  /** `storage.sync` */
  store: KeyValueStore;
  sendToBackground: (message: BackgroundRequest) => Promise<unknown>;
}

/** Options page: every setting auto-saves on change; "clear cache" asks the background. */
export async function startOptions({
  doc,
  t,
  uiLanguage,
  store,
  sendToBackground,
}: OptionsDeps): Promise<void> {
  localizeDocument(doc, t, uiLanguage);
  doc.title = t('optionsTitle');
  const enabled = element(doc, '#enabled', HTMLInputElement);
  const showRatings = element(doc, '#show-ratings', HTMLInputElement);
  const display = element(doc, '#display', HTMLSelectElement);
  const hosts = element(doc, '#disabled-hosts', HTMLTextAreaElement);
  const clearCache = element(doc, '#clear-cache', HTMLButtonElement);
  const status = element(doc, '#status', HTMLElement);

  const settings = await loadSettings(store);
  enabled.checked = settings.enabled;
  showRatings.checked = settings.showRatings;
  display.value = settings.display;
  hosts.value = settings.disabledHosts.join('\n');

  // Each control writes only its own field on top of the latest stored settings.
  const save = (change: (current: Settings) => Settings) => async () => {
    const next = await updateSettings(store, change);
    hosts.value = next.disabledHosts.join('\n');
    status.textContent = t('optionsSaved');
  };

  enabled.addEventListener(
    'change',
    save((s) => ({ ...s, enabled: enabled.checked })),
  );
  showRatings.addEventListener(
    'change',
    save((s) => ({ ...s, showRatings: showRatings.checked })),
  );
  display.addEventListener(
    'change',
    save((s) => normalizeSettings({ ...s, display: display.value })),
  );
  hosts.addEventListener(
    'change',
    save((s) => normalizeSettings({ ...s, disabledHosts: hosts.value.split(/\s+/) })),
  );
  clearCache.addEventListener('click', async () => {
    await sendToBackground({ type: 'clearCache' });
    status.textContent = t('optionsCacheCleared');
  });
}
