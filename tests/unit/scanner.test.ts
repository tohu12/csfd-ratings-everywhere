import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundLink } from '@/lib/linkify';
import { createScanner, type Scanner } from '@/lib/scanner';
import { loadPage } from '../helpers/dom';
import { fakeMutationObserver, manualIdle, manualTimers } from '../helpers/fakes';

describe('createScanner', () => {
  let idle: ReturnType<typeof manualIdle>;
  let timers: ReturnType<typeof manualTimers>;
  let mutations: ReturnType<typeof fakeMutationObserver>;
  let found: FoundLink[];
  let scanner: Scanner;

  const start = (root: HTMLElement = document.body) => {
    scanner = createScanner({
      root,
      onLinks: (links) => found.push(...links),
      scheduleIdle: idle.schedule,
      createMutationObserver: mutations.create,
      setTimer: timers.set,
      debounceMs: 300,
    });
    scanner.start();
  };

  beforeEach(() => {
    idle = manualIdle();
    timers = manualTimers();
    mutations = fakeMutationObserver();
    found = [];
  });

  it('reports existing links at once and linkifies text in idle time', () => {
    loadPage('warcenter-like.html');
    start();
    expect(found.map((f) => f.link.id)).toEqual([1773198]);
    expect(idle.pending).toBe(1);
    idle.runAll();
    expect(found.map((f) => f.link.id)).toEqual([1773198, 1700849, 6]);
    expect(mutations.observer.observe).toHaveBeenCalledWith(document.body, {
      childList: true,
      subtree: true,
    });
  });

  it('finds an anchor whose text does not mention ČSFD', () => {
    document.body.innerHTML = '<a href="https://www.csfd.cz/film/3-x/">Poberta</a>';
    start();
    expect(found.map((f) => f.link.id)).toEqual([3]);
  });

  it('does not walk text on pages without ČSFD text', () => {
    document.body.innerHTML = '<p>Nothing to see</p>';
    const walker = vi.spyOn(document, 'createTreeWalker');
    start();
    expect(walker).not.toHaveBeenCalled();
    expect(idle.pending).toBe(0);
  });

  it('splits work into chunks and always makes progress', () => {
    document.body.innerHTML = Array.from(
      { length: 5 },
      (_, i) => `<p>csfd.cz/film/${i + 1}</p>`,
    ).join('');
    start();
    idle.runOne(1); // budget for one extra node beyond the guaranteed one
    expect(found).toHaveLength(2);
    idle.runOne(0); // exhausted deadline still processes one node
    expect(found).toHaveLength(3);
    idle.runAll();
    expect(found.map((f) => f.link.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('skips text nodes that were removed or moved into skipped areas before processing', () => {
    document.body.innerHTML =
      '<p id="a">csfd.cz/film/1</p><p id="b">csfd.cz/film/2</p><pre id="pre"></pre>';
    start();
    document.getElementById('a')?.remove();
    const b = document.getElementById('b');
    if (b?.firstChild) {
      document.getElementById('pre')?.append(b.firstChild);
    }
    idle.runAll();
    expect(found).toEqual([]);
  });

  it('processes added content after a debounce and ignores our own nodes', () => {
    document.body.innerHTML = '<div id="feed"></div>';
    start();
    const post = document.createElement('p');
    post.textContent = 'Nový film csfd.cz/film/77';
    const own = document.createElement('span');
    own.setAttribute('data-csfd-linker', 'badge');
    own.textContent = 'csfd.cz/film/99';
    const plain = document.createElement('p');
    plain.textContent = 'no link here';
    document.getElementById('feed')?.append(post, own, plain);

    mutations.add(post, own, plain);
    mutations.add(post); // duplicate within the same debounce window
    expect(timers.pending).toEqual([300]);
    timers.runAll();
    idle.runAll();
    expect(found.map((f) => f.link.id)).toEqual([77]);
  });

  it('reports an added existing anchor once, and drops nodes detached before the flush', () => {
    document.body.innerHTML = '';
    start();
    const a = document.createElement('a');
    a.href = 'https://www.csfd.cz/film/5-x/';
    a.textContent = 'film';
    const gone = document.createElement('p');
    gone.textContent = 'csfd.cz/film/6';
    document.body.append(a);
    mutations.add(a, gone);
    timers.runAll();
    mutations.add(a);
    timers.runAll();
    idle.runAll();
    expect(found.map((f) => f.link.id)).toEqual([5]);
  });

  it('scans nested additions once, through their added ancestor', () => {
    document.body.innerHTML = '';
    start();
    const outer = document.createElement('div');
    const inner = document.createElement('p');
    inner.textContent = 'csfd.cz/film/31';
    outer.append(inner);
    document.body.append(outer);
    const walker = vi.spyOn(document, 'createTreeWalker');
    mutations.add(outer, inner);
    timers.runAll();
    idle.runAll();
    expect(walker).toHaveBeenCalledTimes(1);
    expect(found.map((f) => f.link.id)).toEqual([31]);
  });

  it('linkifies a bare text node added to the page', () => {
    document.body.innerHTML = '<p id="chat"></p>';
    start();
    const text = document.createTextNode('mrkni na csfd.cz/film/12-x');
    document.getElementById('chat')?.append(text);
    mutations.add(text);
    timers.runAll();
    idle.runAll();
    expect(found.map((f) => f.link.id)).toEqual([12]);
  });

  it('ignores mutation batches with only our own nodes', () => {
    document.body.innerHTML = '';
    start();
    const own = document.createElement('span');
    own.setAttribute('data-csfd-linker', 'badge');
    mutations.add(own);
    expect(timers.pending).toEqual([]);
  });

  it('stop disconnects and abandons pending work', () => {
    loadPage('warcenter-like.html');
    start();
    found = [];
    scanner.stop();
    idle.runAll();
    expect(found).toEqual([]);
    expect(mutations.observer.disconnect).toHaveBeenCalled();
  });
});
