export interface MessageSender {
  id?: string | undefined;
}

export type MessageHandler = (
  message: unknown,
  sender: MessageSender,
) => Promise<unknown> | undefined;

export type RuntimeListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response: unknown) => void,
) => true | undefined;

/**
 * Adapts a promise-returning handler to `runtime.onMessage`. Uses `sendResponse` + `return true`,
 * which every Chromium and Firefox version supports. Returning `undefined` for unhandled
 * messages leaves them to other listeners.
 */
export function toRuntimeListener(handler: MessageHandler): RuntimeListener {
  return (message, sender, sendResponse) => {
    const result = handler(message, sender);
    if (!result) {
      return undefined;
    }
    result.then(sendResponse, () => sendResponse(undefined));
    return true;
  };
}
