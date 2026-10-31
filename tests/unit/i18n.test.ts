import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator, localizeDocument, MESSAGE_KEYS } from '@/lib/i18n';

const LOCALES = ['cs', 'sk', 'en'] as const;
const messages = (lang: string): Record<string, { message: string; placeholders?: object }> =>
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '..', '..', 'public', '_locales', lang, 'messages.json'),
      'utf8',
    ),
  );

describe('locales', () => {
  it.each(LOCALES)('%s defines exactly the typed message keys', (lang) => {
    expect(Object.keys(messages(lang)).sort()).toEqual([...MESSAGE_KEYS].sort());
  });

  it.each(LOCALES)('%s uses the same placeholders as en', (lang) => {
    const en = messages('en');
    for (const [key, value] of Object.entries(messages(lang))) {
      expect(Object.keys(value.placeholders ?? {}), key).toEqual(
        Object.keys(en[key]?.placeholders ?? {}),
      );
    }
  });

  it.each(LOCALES)('%s keeps the store name within 75 characters', (lang) => {
    expect(messages(lang)['extName']?.message.length).toBeLessThanOrEqual(75);
  });
});

describe('createTranslator', () => {
  it('passes substitutions and falls back to the key for missing strings', () => {
    const getMessage = vi.fn((key: string) => (key === 'badgeNone' ? 'Bez hodnocení' : ''));
    const t = createTranslator(getMessage);
    expect(t('badgeNone')).toBe('Bez hodnocení');
    expect(t('badgeRating', 'Film', '78')).toBe('badgeRating');
    expect(getMessage).toHaveBeenLastCalledWith('badgeRating', ['Film', '78']);
  });
});

describe('localizeDocument', () => {
  it('sets the document language and translates known keys only', () => {
    document.body.innerHTML =
      '<p data-i18n="popupLinks">x</p><p data-i18n="nope">keep</p><p data-i18n>empty</p>';
    localizeDocument(document, (key) => `T:${key}`, 'cs');
    expect(document.documentElement.lang).toBe('cs');
    expect([...document.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'T:popupLinks',
      'keep',
      'empty',
    ]);
  });
});
