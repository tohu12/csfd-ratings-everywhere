import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './fixtures';

/** Loads an HTML fixture into the happy-dom document body (test setup only). */
export function loadPage(name: string): HTMLElement {
  document.body.innerHTML = fixture(`pages/${name}`);
  return document.body;
}

/** Loads an extension page's markup (scripts and styles stripped) into the document. */
export function loadExtensionPage(entry: 'popup' | 'options'): void {
  const html = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'entrypoints', entry, 'index.html'),
    'utf8',
  );
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}
