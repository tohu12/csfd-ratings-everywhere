import { describe, expect, it, vi } from 'vitest';
import { toRuntimeListener } from '@/lib/runtime-listener';

describe('toRuntimeListener', () => {
  it('returns true and answers asynchronously via sendResponse', async () => {
    const sendResponse = vi.fn();
    const listener = toRuntimeListener(async () => 42);
    expect(listener({}, { id: 'x' }, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(42));
  });

  it('responds with undefined when the handler rejects', async () => {
    const sendResponse = vi.fn();
    toRuntimeListener(() => Promise.reject(new Error('x')))({}, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(undefined));
  });

  it('returns undefined for unhandled messages and never responds', () => {
    const sendResponse = vi.fn();
    expect(toRuntimeListener(() => undefined)({}, {}, sendResponse)).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
