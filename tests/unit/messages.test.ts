import { describe, expect, it } from 'vitest';
import { isBackgroundRequest, isContentRequest, isContentStats } from '@/lib/messages';

describe('isBackgroundRequest', () => {
  it.each([{ type: 'getRating', id: 1 }, { type: 'peekRating', id: 2 }, { type: 'clearCache' }])(
    'accepts %j',
    (msg) => {
      expect(isBackgroundRequest(msg)).toBe(true);
    },
  );

  it.each([
    null,
    'getRating',
    { type: 'getRating' },
    { type: 'getRating', id: 0 },
    { type: 'getRating', id: 1.5 },
    { type: 'getRating', id: '1' },
    { type: 'peekRating', id: -1 },
    { type: 'other' },
  ])('rejects %j', (msg) => {
    expect(isBackgroundRequest(msg)).toBe(false);
  });
});

describe('isContentRequest', () => {
  it('accepts getStats only', () => {
    expect(isContentRequest({ type: 'getStats' })).toBe(true);
    expect(isContentRequest({ type: 'getRating', id: 1 })).toBe(false);
    expect(isContentRequest(undefined)).toBe(false);
  });
});

describe('isContentStats', () => {
  it('validates the stats shape', () => {
    expect(isContentStats({ links: 3 })).toBe(true);
    expect(isContentStats({ links: '3' })).toBe(false);
    expect(isContentStats(null)).toBe(false);
  });
});
