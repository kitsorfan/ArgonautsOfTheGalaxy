declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(msg: string): void };
    __SAVE__?: string;
    __onBack?: () => void;
    __onPause?: () => void;
    __game?: unknown;
  }
}

export const inApp = () => !!window.ReactNativeWebView;

export function post(msg: Record<string, unknown>) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

/** Opens a web page or an email to write, outside the game (the app hands it to the phone). */
export function openLink(url: string) {
  if (inApp()) post({ type: 'link', url });
  else window.open(url, '_blank', 'noopener');
}

let hapticsOn = true;
export function setHaptics(on: boolean) {
  hapticsOn = on;
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning') {
  if (!hapticsOn) return;
  if (inApp()) post({ type: 'haptic', kind });
  else navigator.vibrate?.(kind === 'heavy' ? 40 : kind === 'medium' ? 22 : 10);
}
