const FOREGROUND_INTERVAL_MS = 10_000;
const BACKGROUND_INTERVAL_MS = 60_000;

// Shared cadence policy for the in-app badge pollers.
//
// The badge is polled every 10s so it stays live while somebody is looking at
// it. That is the right cadence for a visible tab and a wasteful one for a
// hidden tab multiplied across a user base: two services at 10s is 12
// requests a minute per open tab, forever, most of them to a tab nobody is
// looking at.
//
// So: only slow down when the tab is hidden *and* push notifications are on,
// because that is the only case where something else is already responsible
// for telling the user something happened. Nothing the user can see gets
// slower — a hidden tab's badge is not on screen, and `interruptibleWait`
// polls immediately when the tab comes back.
export function pollIntervalMs({ pushEnabled } = {}) {
  const hidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  return hidden && pushEnabled
    ? BACKGROUND_INTERVAL_MS
    : FOREGROUND_INTERVAL_MS;
}

// A sleep that ends early when the tab becomes visible.
//
// Without this, backing off in the background would cost up to a full
// interval of staleness at the exact moment the user looks at the badge.
export function interruptibleWait(ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      resolve();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") finish();
    };
    const timer = setTimeout(finish, ms);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
  });
}
