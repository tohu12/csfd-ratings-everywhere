import { isRecord } from './rating';

/**
 * Content script / popup / options → background.
 * `getRating` may hit the network and is only sent after a user action; `peekRating` reads the cache only.
 */
export type BackgroundRequest =
  | { type: 'getRating'; id: number }
  | { type: 'peekRating'; id: number }
  | { type: 'clearCache' };

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
