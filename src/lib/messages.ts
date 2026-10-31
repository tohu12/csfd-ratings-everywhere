import type { TitleQuery } from './csfd-search';
import { isRating, isRecord, type Rating } from './rating';

/**
 * Content script / popup / options → background.
 * `getRating` may hit the network (only as SPEC §4 allows); `peekRating` reads the cache only.
 */
export type BackgroundRequest =
  | { type: 'getRating'; id: number }
  | { type: 'peekRating'; id: number }
  | { type: 'clearCache' }
  /** A VOD detail view was opened (SPEC §4b): find the title on ČSFD, then its rating. */
  | ({ type: 'findTitle' } & TitleQuery);

/** Answer to `findTitle`. `unsure` covers both "several candidates" and "none". */
export type TitleResult =
  | { status: 'found'; id: number; rating: Rating }
  | { status: 'unsure' }
  | { status: 'blocked' }
  | { status: 'error' };

const MAX_TITLES = 2;
const MAX_TITLE_LENGTH = 200;

/** Popup → content script of the active tab. */
export type ContentRequest = { type: 'getStats' };

export interface ContentStats {
  links: number;
}

export function isBackgroundRequest(value: unknown): value is BackgroundRequest {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['type']) {
    case 'getRating':
    case 'peekRating': {
      const id = value['id'];
      return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
    }
    case 'clearCache':
      return true;
    case 'findTitle':
      return isTitleQuery(value);
    default:
      return false;
  }
}

function isTitleQuery(value: Record<string, unknown>): boolean {
  const { titles, year, kind } = value;
  return (
    Array.isArray(titles) &&
    titles.length >= 1 &&
    titles.length <= MAX_TITLES &&
    titles.every((t) => typeof t === 'string' && t.length >= 1 && t.length <= MAX_TITLE_LENGTH) &&
    (year === null || (Number.isInteger(year) && Number(year) >= 1800 && Number(year) <= 2100)) &&
    (kind === null || kind === 'film' || kind === 'series')
  );
}

export function isTitleResult(value: unknown): value is TitleResult {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['status']) {
    case 'found': {
      const id = value['id'];
      return (
        typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && isRating(value['rating'])
      );
    }
    case 'unsure':
    case 'blocked':
    case 'error':
      return true;
    default:
      return false;
  }
}

export function isContentRequest(value: unknown): value is ContentRequest {
  return isRecord(value) && value['type'] === 'getStats';
}

export function isContentStats(value: unknown): value is ContentStats {
  return isRecord(value) && Number.isSafeInteger(value['links']);
}
