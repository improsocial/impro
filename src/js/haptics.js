import { Haptics, ImpactStyle } from "/js/lib/capacitor.js";
import { untrack } from "/js/signals.js";
import { isNative, isStandalonePWA } from "/js/utils.js";
import { deviceState } from "/js/deviceState.js";

function hapticsSupported() {
  return (
    isNative() || (isStandalonePWA() && typeof navigator.vibrate === "function")
  );
}

async function impact(style) {
  if (
    !hapticsSupported() ||
    untrack(() => deviceState.$hapticsDisabled.get())
  ) {
    return;
  }
  try {
    await Haptics.impact({ style });
  } catch (error) {
    // do nothing
  }
}

export const haptics = {
  isSupported: hapticsSupported,
  impactLight: () => impact(ImpactStyle.Light),
  impactMedium: () => impact(ImpactStyle.Medium),
  impactHeavy: () => impact(ImpactStyle.Heavy),
};
