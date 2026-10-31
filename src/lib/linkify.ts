import { type CsfdLink, findCsfdUrls, mightContainCsfd, parseCsfdUrl } from './csfd-url';

/** Marks every node the extension inserts, so it is never processed again. */
export const OWN_ATTR = 'data-csfd-linker';

const SKIP_SELECTOR = [
  'a',
  'script',
  'style',
  'noscript',
  'textarea',
  'input',
  'select',
  'option',
  'code',
  'pre',
  'svg',
  '[contenteditable]:not([contenteditable="false"])',
  `[${OWN_ATTR}]`,
].join(',');

export interface FoundLink {
  readonly anchor: HTMLAnchorElement;
  readonly link: CsfdLink;
}

/** True when the node sits in (or is) a subtree whose text must not be touched. */
export function isInsideSkipped(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return el === null || el.closest(SKIP_SELECTOR) !== null;
}

/**
 * Text nodes under `root` that may contain a ČSFD URL. Skipped subtrees are pruned
 * by the walker itself (FILTER_REJECT), so their descendants are never visited.
 */
export function collectTextNodes(root: Node): Text[] {
  if (root instanceof Text) {
    return mightContainCsfd(root.data) && !isInsideSkipped(root) ? [root] : [];
  }
  if (root instanceof Element && isInsideSkipped(root)) {
    return [];
  }
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Text) {
        return mightContainCsfd(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return (node as Element).matches(SKIP_SELECTOR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text);
  }
  return nodes;
}

/** Replaces ČSFD URLs in a text node with anchors. Returns the created anchors. */
export function linkifyTextNode(node: Text): FoundLink[] {
  const matches = findCsfdUrls(node.data);
  if (matches.length === 0) {
    return [];
  }
  const doc = node.ownerDocument;
  const fragment = doc.createDocumentFragment();
  const found: FoundLink[] = [];
  let cursor = 0;
  for (const match of matches) {
    fragment.append(node.data.slice(cursor, match.start));
    const anchor = doc.createElement('a');
    anchor.href = match.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = node.data.slice(match.start, match.end);
    anchor.setAttribute(OWN_ATTR, 'link');
    fragment.append(anchor);
    found.push({ anchor, link: { id: match.id, href: match.href } });
    cursor = match.end;
  }
  fragment.append(node.data.slice(cursor));
  node.replaceWith(fragment);
  return found;
}

/** Pre-existing `<a>` elements (in or equal to `root`) that point to a ČSFD film. */
export function findExistingLinks(root: ParentNode): FoundLink[] {
  const selector = `a[href*="csfd." i]:not([${OWN_ATTR}])`;
  const anchors = [...root.querySelectorAll<HTMLAnchorElement>(selector)];
  if (root instanceof HTMLAnchorElement && root.matches(selector)) {
    anchors.unshift(root);
  }
  const found: FoundLink[] = [];
  for (const anchor of anchors) {
    // Never touch editors, code blocks etc. (a badge would end up in the user's sent HTML).
    if (anchor.parentElement === null || isInsideSkipped(anchor.parentElement)) {
      continue;
    }
    const link = parseCsfdUrl(anchor.href);
    if (link) {
      found.push({ anchor, link });
    }
  }
  return found;
}
