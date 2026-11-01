export const MESSAGE_KEYS = [
  'extName',
  'extDescription',
  'badgeIdle',
  'badgeLoading',
  'badgeRating',
  'badgeRatingWithCount',
  'badgeNone',
  'badgeBlocked',
  'badgeError',
  'badgeOpen',
  'badgeUnsure',
  'untitled',
  'popupSite',
  'popupSiteUnavailable',
  'popupOnCsfd',
  'popupEnabled',
  'popupLinks',
  'popupOptions',
  'optionsTitle',
  'optionsEnabled',
  'optionsShowRatings',
  'optionsDisplay',
  'optionsDisplayBadge',
  'optionsDisplayTooltip',
  'optionsDisabledHosts',
  'optionsDisabledHostsHint',
  'optionsClearCache',
  'optionsCacheCleared',
  'optionsSaved',
  'optionsDisclaimer',
  'popupCsfdBroken',
  'popupReport',
  'welcomeTitle',
  'welcomeIntro',
  'welcomeHowTitle',
  'welcomeHowLinks',
  'welcomeHowAuto',
  'welcomeHowHover',
  'welcomeHowVod',
  'welcomeColorsTitle',
  'welcomeColorGood',
  'welcomeColorAverage',
  'welcomeColorBad',
  'welcomeSettingsHint',
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

export type Translate = (key: MessageKey, ...substitutions: string[]) => string;

/** Typed wrapper over `browser.i18n.getMessage`; falls back to the key so missing strings are visible. */
export function createTranslator(
  getMessage: (key: string, substitutions?: string[]) => string,
): Translate {
  return (key, ...substitutions) => getMessage(key, substitutions) || key;
}

/** Sets `<html lang>` and fills `[data-i18n="key"]` elements of an extension page. */
export function localizeDocument(doc: Document, t: Translate, uiLanguage: string): void {
  doc.documentElement.lang = uiLanguage;
  for (const el of doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset['i18n'];
    if (isMessageKey(key)) {
      el.textContent = t(key);
    }
  }
}

function isMessageKey(key: string | undefined): key is MessageKey {
  return (MESSAGE_KEYS as readonly (string | undefined)[]).includes(key);
}
