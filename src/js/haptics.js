import { Haptics, ImpactStyle } from "/js/lib/capacitor.js";

export async function hapticsImpactMedium() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    // do nothing
  }
}

export async function hapticsImpactLight() {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    // do nothing
  }
}
