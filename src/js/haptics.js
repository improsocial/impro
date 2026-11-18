import { untrack } from "/js/signals.js";
import { isStandalonePWA } from "/js/utils.js";
import { deviceState } from "/js/deviceState.js";

function hapticsSupported() {
  return isStandalonePWA() && typeof navigator.vibrate === "function";
}

async function impact(durationMs) {
  if (
    !hapticsSupported() ||
    untrack(() => deviceState.$hapticsDisabled.get())
  ) {
    return;
  }
  navigator.vibrate([durationMs]);
}

export const haptics = {
  isSupported: hapticsSupported,
  impactLight: () => impact(20),
  impactMedium: () => impact(43),
  impactHeavy: () => impact(61),
};
