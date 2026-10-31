import { describe, expect, it } from 'vitest';
import { element } from '@/lib/dom';

describe('element', () => {
  it('returns the typed element', () => {
    document.body.innerHTML = '<input id="a">';
    expect(element(document, '#a', HTMLInputElement).id).toBe('a');
  });

  it('throws for a missing or wrongly typed element', () => {
    document.body.innerHTML = '<div id="a"></div>';
    expect(() => element(document, '#a', HTMLInputElement)).toThrow('Missing element #a');
    expect(() => element(document, '#b', HTMLElement)).toThrow('Missing element #b');
  });
});
