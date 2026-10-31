import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'fixtures');

export function fixture(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}
