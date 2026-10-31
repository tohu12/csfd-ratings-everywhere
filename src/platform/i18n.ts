import { createTranslator, type Translate } from '@/lib/i18n';

/** The real translator backed by `browser.i18n` (`public/_locales`). */
export function browserTranslator(): Translate {
  return createTranslator((key, substitutions) =>
    browser.i18n.getMessage(key as never, substitutions),
  );
}
