import { isRecord } from './rating';
import type { KeyValueStore } from './store';

/** `badge`: inline pill after every link. `tooltip`: nothing inserted, card on hover/focus. */
export type DisplayMode = 'badge' | 'tooltip';

export interface Settings {
  readonly enabled: boolean;
  readonly display: DisplayMode;
  readonly showRatings: boolean;
  readonly disabledHosts: readonly string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  display: 'badge',
  showRatings: true,
  disabledHosts: [],
};

const KEY = 'settings';

/** Validates stored settings field by field; anything invalid falls back to its default. */
export function normalizeSettings(raw: unknown): Settings {
  const value = isRecord(raw) ? raw : {};
  const hosts = Array.isArray(value['disabledHosts']) ? value['disabledHosts'] : [];
  return {
    enabled: typeof value['enabled'] === 'boolean' ? value['enabled'] : DEFAULT_SETTINGS.enabled,
    display: value['display'] === 'tooltip' ? 'tooltip' : 'badge',
    showRatings:
      typeof value['showRatings'] === 'boolean'
        ? value['showRatings']
        : DEFAULT_SETTINGS.showRatings,
    disabledHosts: [
      ...new Set(hosts.filter((h): h is string => typeof h === 'string').map(normalizeHost)),
    ].filter(Boolean),
  };
}

/** `WWW.Example.com ` → `example.com`. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

export function isHostEnabled(settings: Settings, hostname: string): boolean {
  return settings.enabled && !settings.disabledHosts.includes(normalizeHost(hostname));
}

export function setHostEnabled(settings: Settings, hostname: string, enabled: boolean): Settings {
  const host = normalizeHost(hostname);
  const others = settings.disabledHosts.filter((h) => h !== host);
  return { ...settings, disabledHosts: enabled ? others : [...others, host] };
}

export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  return normalizeSettings((await store.get([KEY]))[KEY]);
}

export async function saveSettings(store: KeyValueStore, settings: Settings): Promise<void> {
  await store.set({ [KEY]: normalizeSettings(settings) });
}

/** Read-modify-write against the latest stored value, so the popup and options page never overwrite each other. */
export async function updateSettings(
  store: KeyValueStore,
  change: (current: Settings) => Settings,
): Promise<Settings> {
  const next = normalizeSettings(change(await loadSettings(store)));
  await saveSettings(store, next);
  return next;
}
