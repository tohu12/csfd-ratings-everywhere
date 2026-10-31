import { describe, expect, it } from 'vitest';
import {
  isBackgroundRequest,
  isContentRequest,
  isContentStats,
  isTitleResult,
} from '@/lib/messages';

describe('isBackgroundRequest', () => {
  it.each([
    { type: 'getRating', id: 1 },
    { type: 'peekRating', id: 2 },
    { type: 'clearCache' },
    { type: 'findTitle', titles: ['Duna'], year: 2021, kind: 'film' },
    { type: 'findTitle', titles: ['Špetka lásky', 'Salted Love'], year: null, kind: null },
    { type: 'findTitle', titles: ['Lupin'], year: 2026, kind: 'series' },
  ])('accepts %j', (msg) => {
    expect(isBackgroundRequest(msg)).toBe(true);
  });

  it.each([
    null,
    'getRating',
    { type: 'getRating' },
    { type: 'getRating', id: 0 },
    { type: 'getRating', id: 1.5 },
    { type: 'getRating', id: '1' },
    { type: 'peekRating', id: -1 },
    { type: 'other' },
    { type: 'findTitle', titles: [], year: null, kind: null },
    { type: 'findTitle', titles: [''], year: null, kind: null },
    { type: 'findTitle', titles: ['x'.repeat(201)], year: null, kind: null },
    { type: 'findTitle', titles: ['a', 'b', 'c'], year: null, kind: null },
    { type: 'findTitle', titles: [1], year: null, kind: null },
    { type: 'findTitle', titles: 'Duna', year: null, kind: null },
    { type: 'findTitle', titles: ['Duna'], year: 1799, kind: null },
    { type: 'findTitle', titles: ['Duna'], year: 2021.5, kind: null },
    { type: 'findTitle', titles: ['Duna'], year: '2021', kind: null },
    { type: 'findTitle', titles: ['Duna'], year: null, kind: 'episode' },
    { type: 'findTitle', titles: ['Duna'] },
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

describe('isTitleResult', () => {
  it.each([
    { status: 'found', id: 1, rating: { status: 'ok', percent: 80, count: null, title: 'Duna' } },
    { status: 'found', id: 1, rating: { status: 'blocked' } },
    { status: 'unsure' },
    { status: 'blocked' },
    { status: 'error' },
  ])('accepts %j', (value) => {
    expect(isTitleResult(value)).toBe(true);
  });

  it.each([
    null,
    { status: 'found', id: 0, rating: { status: 'error' } },
    { status: 'found', id: 1, rating: { status: 'ok' } },
    { status: 'maybe' },
  ])('rejects %j', (value) => {
    expect(isTitleResult(value)).toBe(false);
  });
});
