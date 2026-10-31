import { beforeEach, describe, expect, it } from 'vitest';
import {
  collectTextNodes,
  findExistingLinks,
  isInsideSkipped,
  linkifyTextNode,
  OWN_ATTR,
} from '@/lib/linkify';
import { loadPage } from '../helpers/dom';

describe('collectTextNodes', () => {
  beforeEach(() => {
    loadPage('warcenter-like.html');
  });

  it('finds candidate text nodes and prunes skipped subtrees', () => {
    const texts = collectTextNodes(document.body).map((t) => t.data.trim());
    expect(texts).toEqual([
      'https://www.csfd.cz/film/1700849-coutures/prehled/',
      'csfd.cz/film/6-not-editable',
    ]);
  });

  it('accepts a candidate text node passed directly', () => {
    const [node] = collectTextNodes(document.body);
    expect(node && collectTextNodes(node)).toEqual([node]);
  });

  it('rejects text nodes without ČSFD or inside skipped elements', () => {
    expect(collectTextNodes(document.createTextNode('nothing here'))).toEqual([]);
    const code = document.querySelector('code');
    expect(code && collectTextNodes(code)).toEqual([]);
    expect(code?.firstChild && collectTextNodes(code.firstChild)).toEqual([]);
  });

  it('works when the root is a document', () => {
    expect(collectTextNodes(document)).toHaveLength(2);
  });
});

describe('isInsideSkipped', () => {
  it('is true for detached text and our own nodes', () => {
    expect(isInsideSkipped(document.createTextNode('x'))).toBe(true);
    const own = document.createElement('span');
    own.setAttribute(OWN_ATTR, 'badge');
    expect(isInsideSkipped(own)).toBe(true);
  });
});

describe('linkifyTextNode', () => {
  it('replaces URLs with anchors and keeps surrounding text intact', () => {
    document.body.innerHTML =
      '<p>Film: https://www.csfd.cz/film/1-a/prehled/, a taky (csfd.cz/film/2-b). Konec</p>';
    const p = document.querySelector('p');
    const text = p?.firstChild as Text;
    const found = linkifyTextNode(text);

    expect(found.map((f) => f.link)).toEqual([
      { id: 1, href: 'https://www.csfd.cz/film/1-a/prehled/' },
      { id: 2, href: 'https://csfd.cz/film/2-b' },
    ]);
    expect(p?.textContent).toBe(
      'Film: https://www.csfd.cz/film/1-a/prehled/, a taky (csfd.cz/film/2-b). Konec',
    );
    const anchors = p?.querySelectorAll('a') ?? [];
    expect(anchors).toHaveLength(2);
    expect(anchors[1]?.textContent).toBe('csfd.cz/film/2-b');
    for (const a of anchors) {
      expect(a.getAttribute(OWN_ATTR)).toBe('link');
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener noreferrer');
    }
  });

  it('leaves text without URLs untouched', () => {
    document.body.innerHTML = '<p>csfd.cz is great</p>';
    const text = document.querySelector('p')?.firstChild as Text;
    expect(linkifyTextNode(text)).toEqual([]);
    expect(text.isConnected).toBe(true);
  });

  it('never creates a javascript: link from crafted text', () => {
    document.body.innerHTML = '<p>javascript:alert(1)//csfd.cz/film/1</p>';
    linkifyTextNode(document.querySelector('p')?.firstChild as Text);
    for (const a of document.querySelectorAll('a')) {
      expect(a.protocol).toBe('https:');
    }
  });
});

describe('findExistingLinks', () => {
  it('returns existing ČSFD film anchors only', () => {
    loadPage('warcenter-like.html');
    const found = findExistingLinks(document.body);
    expect(found.map((f) => [f.anchor.id, f.link.id])).toEqual([['ext', 1773198]]);
  });

  it('skips anchors inside editors and code blocks', () => {
    document.body.innerHTML = `
      <div contenteditable="true"><p><a id="edit" href="https://www.csfd.cz/film/1-x/">a</a></p></div>
      <pre><a href="https://www.csfd.cz/film/2-x/">b</a></pre>
      <p><a id="ok" href="https://www.csfd.cz/film/3-x/">c</a></p>`;
    expect(findExistingLinks(document.body).map((f) => f.link.id)).toEqual([3]);
  });

  it('skips a detached root anchor', () => {
    const a = document.createElement('a');
    a.href = 'https://www.csfd.cz/film/4-x/';
    expect(findExistingLinks(a)).toEqual([]);
  });

  it('includes the root itself and ignores our anchors and non-film links', () => {
    document.body.innerHTML = `
      <a id="root" href="https://www.csfd.cz/film/9-x/">x</a>
      <a ${OWN_ATTR}="link" href="https://www.csfd.cz/film/8-x/">ours</a>
      <a href="https://www.csfd.cz/tvurce/7-x/">creator</a>`;
    const root = document.getElementById('root') as HTMLAnchorElement;
    expect(findExistingLinks(root).map((f) => f.link.id)).toEqual([9]);
    expect(findExistingLinks(document.body).map((f) => f.link.id)).toEqual([9]);
  });
});
