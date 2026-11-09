import { Haptics, ImpactStyle } from "/js/lib/capacitor.js";
import { untrack } from "/js/signals.js";
import { isIOS, isNative, isStandalonePWA } from "/js/utils.js";
import { deviceState } from "/js/deviceState.js";

// iOS Safari has no navigator.vibrate, but we can hack a
// version using a hidden label element.
// See: https://www.npmjs.com/package/ios-vibrator-pro-max
let hapticSwitchLabel = null;

function toggleHapticSwitch() {
  if (!hapticSwitchLabel) {
    hapticSwitchLabel = document.createElement("label");
    hapticSwitchLabel.setAttribute("aria-hidden", "true");
    hapticSwitchLabel.style.display = "none";
    hapticSwitchLabel.addEventListener("click", (event) =>
      event.stopPropagation(),
    );
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    hapticSwitchLabel.append(input);
  }
  if (!hapticSwitchLabel.isConnected) {
    document.body.append(hapticSwitchLabel);
  }
  hapticSwitchLabel.click();
}

function hapticsSupported() {
  return isNative() || isStandalonePWA();
}

async function impact(style) {
  if (
    !hapticsSupported() ||
    untrack(() => deviceState.$hapticsDisabled.get())
  ) {
    return;
  }
  if (!isNative() && isIOS() && typeof navigator.vibrate !== "function") {
    toggleHapticSwitch();
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
