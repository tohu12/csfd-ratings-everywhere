import { isCsfdHost } from './csfd-url';
import { element } from './dom';
import { readBrokenPages } from './health';
import { localizeDocument, type Translate } from './i18n';
import { type ContentRequest, isContentStats } from './messages';
import { isHostEnabled, loadSettings, setHostEnabled, updateSettings } from './settings';
import type { KeyValueStore } from './store';

export interface ActiveTab {
  id?: number | undefined;
  url?: string | undefined;
}

export interface PopupDeps {
  doc: Document;
  t: Translate;
  uiLanguage: string;
  /** `storage.sync` */
  store: KeyValueStore;
  getActiveTab: () => Promise<ActiveTab | undefined>;
  sendToTab: (tabId: number, message: ContentRequest) => Promise<unknown>;
  openOptions: () => void;
  /** `storage.local`: where the background keeps the ČSFD health state (SPEC §6a). */
  local: KeyValueStore;
  /** Extension version, for the problem report. */
  version: string;
}

const REPORT_URL = 'https://github.com/tohu12/csfd-ratings-everywhere/issues/new';

/** Popup: per-site and global switch, link count of the active tab, link to options. */
export async function startPopup({
  doc,
  t,
  uiLanguage,
  store,
  getActiveTab,
  sendToTab,
  openOptions,
  local,
  version,
}: PopupDeps): Promise<void> {
  localizeDocument(doc, t, uiLanguage);
  const siteToggle = element(doc, '#site-toggle', HTMLInputElement);
  const siteName = element(doc, '#site-name', HTMLElement);
  const globalToggle = element(doc, '#global-toggle', HTMLInputElement);
  const linkCount = element(doc, '#link-count', HTMLElement);
  element(doc, '#open-options', HTMLButtonElement).addEventListener('click', openOptions);

  const [settings, tab] = await Promise.all([loadSettings(store), getActiveTab()]);
  globalToggle.checked = settings.enabled;
  globalToggle.addEventListener('change', () => {
    void updateSettings(store, (s) => ({ ...s, enabled: globalToggle.checked }));
  });

  const host = webHostname(tab?.url);
  const onCsfd = host !== null && isCsfdHost(host);
  if (host === null || onCsfd) {
    // Nothing to switch: browser pages can't run content scripts, and on ČSFD it is excluded.
    siteToggle.disabled = true;
    siteToggle.checked = false;
    siteName.textContent = t(onCsfd ? 'popupOnCsfd' : 'popupSiteUnavailable');
  } else {
    siteName.textContent = host;
    siteToggle.checked = isHostEnabled({ ...settings, enabled: true }, host);
    siteToggle.addEventListener('change', () => {
      void updateSettings(store, (s) => setHostEnabled(s, host, siteToggle.checked));
    });
  }

  const warning = showCsfdWarning(doc, local, version);

  linkCount.textContent = '–';
  if (tab?.id !== undefined && host !== null && !onCsfd) {
    const stats = await sendToTab(tab.id, { type: 'getStats' }).catch(() => null);
    if (isContentStats(stats)) {
      linkCount.textContent = String(stats.links);
    }
  }
  await warning;
}

/** Says when the background can't read ČSFD pages; the report carries no browsing data. */
async function showCsfdWarning(doc: Document, local: KeyValueStore, version: string) {
  const pages = await readBrokenPages(local).catch(() => []);
  if (pages.length === 0) {
    return;
  }
  const kinds = pages.join(', ');
  const report = new URL(REPORT_URL);
  report.searchParams.set('title', `ČSFD pages cannot be read: ${kinds}`);
  report.searchParams.set(
    'body',
    `The extension could not read ČSFD ${kinds} pages.\nVersion: ${version}`,
  );
  element(doc, '#csfd-report', HTMLAnchorElement).href = report.href;
  element(doc, '#csfd-warning', HTMLElement).hidden = false;
}

function webHostname(url: string | undefined): string | null {
  try {
    const parsed = new URL(url ?? '');
    return /^https?:$/.test(parsed.protocol) ? parsed.hostname : null;
  } catch {
    return null;
  }
}
