/** Typed `querySelector` for extension pages whose markup we own: a missing element is a bug. */
export function element<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new (...args: never[]) => T,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) {
    throw new Error(`Missing element ${selector}`);
  }
  return el;
}
