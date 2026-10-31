export type Rating =
  | {
      readonly status: 'ok';
      readonly percent: number;
      readonly count: number | null;
      readonly title: string | null;
    }
  | { readonly status: 'none'; readonly title: string | null }
  | { readonly status: 'blocked' }
  | { readonly status: 'error' };

export type RatingColor = 'good' | 'average' | 'bad';

export const BLOCKED: Rating = { status: 'blocked' };
export const ERROR: Rating = { status: 'error' };

/** ČSFD colour bands: red ≥ 70 %, blue 30–69 %, grey < 30 %. */
export function ratingColor(percent: number): RatingColor {
  if (percent >= 70) {
    return 'good';
  }
  return percent >= 30 ? 'average' : 'bad';
}

/** Runtime guard for ratings coming from messages or storage. */
export function isRating(value: unknown): value is Rating {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['status']) {
    case 'ok':
      return (
        isPercent(value['percent']) &&
        isNullable(value['count'], isCount) &&
        isNullable(value['title'], isString)
      );
    case 'none':
      return isNullable(value['title'], isString);
    case 'blocked':
    case 'error':
      return true;
    default:
      return false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullable(value: unknown, guard: (v: unknown) => boolean): boolean {
  return value === null || guard(value);
}
