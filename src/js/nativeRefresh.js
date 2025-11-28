import { registerPlugin, Capacitor } from "/js/lib/capacitor.js";

// IOS only for now, because I couldn't get a custom capacitor plugin to work

function sendToNative(data) {
  if (window.webkit && window.webkit.messageHandlers.appHandler) {
    window.webkit.messageHandlers.appHandler.postMessage(data);
  }
}

export async function enableNativeRefresh() {
  if (Capacitor.isNativePlatform()) {
    sendToNative({ type: "refresh", enabled: true });
  }
}

export async function disableNativeRefresh() {
  if (Capacitor.isNativePlatform()) {
    sendToNative({ type: "refresh", enabled: false });
  }
}

export async function dispatchNativeRefreshEnded() {
  if (Capacitor.isNativePlatform()) {
    sendToNative({ type: "refresh-ended" });
  }
}
