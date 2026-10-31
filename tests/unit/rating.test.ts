import { describe, expect, it } from 'vitest';
import { BLOCKED, ERROR, isRating, isRecord, ratingColor } from '@/lib/rating';

describe('ratingColor', () => {
  it.each([
    [100, 'good'],
    [70, 'good'],
    [69, 'average'],
    [30, 'average'],
    [29, 'bad'],
    [0, 'bad'],
  ] as const)('%i %% → %s', (percent, color) => {
    expect(ratingColor(percent)).toBe(color);
  });
});

describe('isRating', () => {
  it.each([
    { status: 'ok', percent: 78, count: 12, title: 'Film' },
    { status: 'ok', percent: 0, count: null, title: null },
    { status: 'none', title: null },
    { status: 'none', title: 'Film' },
    BLOCKED,
    ERROR,
  ])('accepts %j', (value) => {
    expect(isRating(value)).toBe(true);
  });

  it.each([
    null,
    'ok',
    [],
    {},
    { status: 'weird' },
    { status: 'ok', percent: 101, count: 1, title: null },
    { status: 'ok', percent: 50.5, count: 1, title: null },
    { status: 'ok', percent: -1, count: 1, title: null },
    { status: 'ok', percent: '78', count: 1, title: null },
    { status: 'ok', percent: 78, count: -1, title: null },
    { status: 'ok', percent: 78, count: 1.5, title: null },
    { status: 'ok', percent: 78, title: null },
    { status: 'ok', percent: 78, count: 1, title: 5 },
    { status: 'none' },
    { status: 'none', title: 1 },
  ])('rejects %j', (value) => {
    expect(isRating(value)).toBe(false);
  });
});

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});
