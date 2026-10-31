import { createBackgroundApp } from '@/lib/background-app';
import { toRuntimeListener } from '@/lib/runtime-listener';

export default defineBackground(() => {
  const handle = createBackgroundApp({
    runtimeId: browser.runtime.id,
    local: browser.storage.local,
    session: browser.storage.session,
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    setTimer: (callback, ms) => setTimeout(callback, ms),
  });
  // Registered synchronously at start-up so a woken service worker receives the message.
  browser.runtime.onMessage.addListener(toRuntimeListener(handle));
});
