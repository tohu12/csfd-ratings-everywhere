import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isHostEnabled,
  loadSettings,
  normalizeHost,
  normalizeSettings,
  saveSettings,
  setHostEnabled,
  updateSettings,
} from '@/lib/settings';
import { memoryStore } from '../helpers/memory-store';

describe('normalizeSettings', () => {
  it('returns defaults for missing or invalid data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        enabled: 'yes',
        showRatings: 1,
        display: 'popup',
        disabledHosts: 'a',
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and normalises, dedupes and cleans hosts', () => {
    expect(
      normalizeSettings({
        enabled: false,
        showRatings: false,
        display: 'tooltip',
        disabledHosts: ['WWW.Example.com ', 'example.com', 3, '', '  ', 'b.cz'],
      }),
    ).toEqual({
      enabled: false,
      showRatings: false,
      display: 'tooltip',
      disabledHosts: ['example.com', 'b.cz'],
    });
  });
});

describe('normalizeHost', () => {
  it('lower-cases, trims and drops a leading www.', () => {
    expect(normalizeHost('  WWW.WarCenter.cz ')).toBe('warcenter.cz');
    expect(normalizeHost('sub.www.example.com')).toBe('sub.www.example.com');
  });
});

describe('isHostEnabled', () => {
  it('is false when globally disabled or the host is listed', () => {
    expect(isHostEnabled(DEFAULT_SETTINGS, 'a.cz')).toBe(true);
    expect(isHostEnabled({ ...DEFAULT_SETTINGS, enabled: false }, 'a.cz')).toBe(false);
    expect(isHostEnabled({ ...DEFAULT_SETTINGS, disabledHosts: ['a.cz'] }, 'www.A.cz')).toBe(false);
  });
});

describe('setHostEnabled', () => {
  it('adds and removes a host without duplicates', () => {
    const off = setHostEnabled(DEFAULT_SETTINGS, 'www.a.cz', false);
    expect(off.disabledHosts).toEqual(['a.cz']);
    expect(setHostEnabled(off, 'a.cz', false).disabledHosts).toEqual(['a.cz']);
    expect(setHostEnabled(off, 'A.cz', true).disabledHosts).toEqual([]);
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips normalised settings through the store', async () => {
    const store = memoryStore();
    expect(await loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(store, { ...DEFAULT_SETTINGS, disabledHosts: ['WWW.x.cz'] });
    expect(store.data.get('settings')).toMatchObject({ disabledHosts: ['x.cz'] });
    expect((await loadSettings(store)).disabledHosts).toEqual(['x.cz']);
  });
});

describe('updateSettings', () => {
  it('applies the change to the latest stored value and returns it normalised', async () => {
    const store = memoryStore({ settings: { ...DEFAULT_SETTINGS, disabledHosts: ['a.cz'] } });
    const next = await updateSettings(store, (s) => ({
      ...s,
      disabledHosts: [...s.disabledHosts, 'WWW.B.cz'],
    }));
    expect(next.disabledHosts).toEqual(['a.cz', 'b.cz']);
    expect(store.data.get('settings')).toEqual(next);
  });
});
