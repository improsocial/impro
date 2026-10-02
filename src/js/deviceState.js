import { Signal, PersistedReactiveStore } from "/js/signals.js";
import { prefersReducedMotion } from "/js/utils.js";

// Local client state, persisted per device rather than per account
export const deviceState = new PersistedReactiveStore("device-state");
deviceState.$autoplayDisabledSetting = new Signal.State(null);
deviceState.$autoplayDisabled = new Signal.Computed(
  () => deviceState.$autoplayDisabledSetting.get() ?? prefersReducedMotion(),
);
