import { mightContainCsfd } from './csfd-url';
import {
  collectTextNodes,
  type FoundLink,
  findExistingLinks,
  isInsideSkipped,
  linkifyTextNode,
  OWN_ATTR,
} from './linkify';

export interface IdleDeadlineLike {
  timeRemaining(): number;
}

export interface ScannerDeps {
  root: HTMLElement;
  onLinks: (found: FoundLink[]) => void;
  scheduleIdle: (callback: (deadline: IdleDeadlineLike) => void) => void;
  createMutationObserver: (callback: MutationCallback) => MutationObserver;
  setTimer: (callback: () => void, ms: number) => unknown;
  debounceMs: number;
}

export interface Scanner {
  start(): void;
  stop(): void;
}

/**
 * Finds ČSFD links under `root` now and in content added later.
 * Existing anchors are reported immediately; text nodes are linkified in idle-time chunks.
 */
export function createScanner(deps: ScannerDeps): Scanner {
  const { root, onLinks, scheduleIdle, setTimer, debounceMs } = deps;
  const seenAnchors = new WeakSet<HTMLAnchorElement>();
  let pendingText: Text[] = [];
  let idleScheduled = false;
  let addedNodes = new Set<Node>();
  let flushArmed = false;
  let running = false;

  const report = (found: FoundLink[]) => {
    const fresh = found.filter(({ anchor }) => !seenAnchors.has(anchor));
    for (const { anchor } of fresh) {
      seenAnchors.add(anchor);
    }
    if (fresh.length > 0) {
      onLinks(fresh);
    }
  };

  const processChunk = (deadline: IdleDeadlineLike) => {
    idleScheduled = false;
    if (!running) {
      return;
    }
    const found: FoundLink[] = [];
    // Always make progress, even when the browser hands us an exhausted deadline.
    do {
      const node = pendingText.shift();
      if (node?.isConnected && !isInsideSkipped(node)) {
        found.push(...linkifyTextNode(node));
      }
    } while (pendingText.length > 0 && deadline.timeRemaining() > 0);
    report(found);
    scheduleProcessing();
  };

  const scheduleProcessing = () => {
    if (!idleScheduled && pendingText.length > 0) {
      idleScheduled = true;
      scheduleIdle(processChunk);
    }
  };

  const scan = (node: Node) => {
    // Anchors are found by a native selector on href: their text may not mention ČSFD at all.
    if (node instanceof Element) {
      report(findExistingLinks(node));
    }
    if (mightContainCsfd(node.textContent)) {
      pendingText.push(...collectTextNodes(node));
      scheduleProcessing();
    }
  };

  const flushMutations = () => {
    flushArmed = false;
    const nodes = addedNodes;
    addedNodes = new Set();
    for (const node of nodes) {
      // Own nodes were already filtered when recorded; nested additions are covered by their ancestor.
      if (node.isConnected && !hasAncestorIn(node, nodes)) {
        scan(node);
      }
    }
  };

  const observer = deps.createMutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!isOwnNode(node)) {
          addedNodes.add(node);
        }
      }
    }
    if (!flushArmed && addedNodes.size > 0) {
      flushArmed = true;
      setTimer(flushMutations, debounceMs);
    }
  });

  return {
    start() {
      running = true;
      scan(root);
      observer.observe(root, { childList: true, subtree: true });
    },
    stop() {
      running = false;
      observer.disconnect();
      pendingText = [];
      addedNodes.clear();
    },
  };
}

function hasAncestorIn(node: Node, nodes: Set<Node>): boolean {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (nodes.has(parent)) {
      return true;
    }
  }
  return false;
}

function isOwnNode(node: Node): boolean {
  return node instanceof Element && node.hasAttribute(OWN_ATTR);
}
