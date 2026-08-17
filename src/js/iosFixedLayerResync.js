import { isIOS } from "/js/utils.js";

const IOS_FIXED_LAYER_RESYNC_DEBOUNCE_MS = 150;
const IOS_FIXED_LAYER_RESYNC_SUPPRESSION_MS = 500;

// Hack to workaround incorrect footer positioning in iOS Safari -
// scrolls the view by 1px to reset positioning
// https://bugs.webkit.org/show_bug.cgi?id=254861
// https://bugs.webkit.org/show_bug.cgi?id=301172
// https://bugs.webkit.org/show_bug.cgi?id=312149
export function resyncIOSFixedLayers() {
  if (!isIOS()) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const x = window.scrollX;
      const y = window.scrollY;
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const nudgedY = y < maxY ? y + 1 : Math.max(0, y - 1);
      if (nudgedY === y) return;
      window.scrollTo(x, nudgedY);
      requestAnimationFrame(() => window.scrollTo(x, y));
    });
  });
}

export function installIOSFixedLayerResync() {
  if (!isIOS()) return () => {};

  let debounceTimer = null;
  let suppressionTimer = null;
  let eventsSuppressed = false;

  const scheduleResync = () => {
    if (eventsSuppressed) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      eventsSuppressed = true;
      resyncIOSFixedLayers();

      // Suppress scroll events while scrolling manually
      clearTimeout(suppressionTimer);
      suppressionTimer = setTimeout(() => {
        suppressionTimer = null;
        eventsSuppressed = false;
      }, IOS_FIXED_LAYER_RESYNC_SUPPRESSION_MS);
    }, IOS_FIXED_LAYER_RESYNC_DEBOUNCE_MS);
  };

  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener("resize", scheduleResync);
  visualViewport?.addEventListener("scroll", scheduleResync);
  window.addEventListener("scrollend", scheduleResync);
  window.addEventListener("pageshow", scheduleResync);

  return () => {
    clearTimeout(debounceTimer);
    clearTimeout(suppressionTimer);
    visualViewport?.removeEventListener("resize", scheduleResync);
    visualViewport?.removeEventListener("scroll", scheduleResync);
    window.removeEventListener("scrollend", scheduleResync);
    window.removeEventListener("pageshow", scheduleResync);
  };
}
