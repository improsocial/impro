import { Capacitor, StatusBar } from "/js/lib/capacitor.js";
import { Signal } from "/js/signals.js";

function getRootStyle() {
  return getComputedStyle(document.documentElement);
}

export function getDefaultHighlightColor() {
  return getRootStyle().getPropertyValue("--blue");
}

export function getDefaultLikeColor() {
  return getRootStyle().getPropertyValue("--pink");
}

export function getDefaultColorScheme() {
  return "system";
}

export class Theme {
  constructor({ highlightColor, likeColor, colorScheme }) {
    this.$highlightColor = new Signal.State(highlightColor);
    this.$likeColor = new Signal.State(likeColor);
    this.$colorScheme = new Signal.State(colorScheme);
  }

  getBackgroundColor() {
    return getRootStyle().getPropertyValue("--background-color");
  }

  updateHighlightColor(highlightColor) {
    this.$highlightColor.set(highlightColor);
    this.apply();
    this.save();
  }

  updateLikeColor(likeColor) {
    this.$likeColor.set(likeColor);
    this.apply();
    this.save();
  }

  updateColorScheme(colorScheme) {
    this.$colorScheme.set(colorScheme);
    this.apply();
    this.save();
  }

  apply() {
    const highlightColor = this.$highlightColor.get();
    const likeColor = this.$likeColor.get();
    const colorScheme = this.$colorScheme.get();
    document.documentElement.style.setProperty(
      `--highlight-color`,
      highlightColor,
    );
    document.documentElement.style.setProperty(`--like-color`, likeColor);
    // Apply color scheme
    if (colorScheme === "system") {
      document.documentElement.style.setProperty("color-scheme", "light dark");
    } else {
      document.documentElement.style.setProperty("color-scheme", colorScheme);
    }
    // Background color for iOS
    const backgroundColor = this.getBackgroundColor();
    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = backgroundColor;
    // Status bar color for iOS native
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: backgroundColor });
    }
  }

  save() {
    const highlightColor = this.$highlightColor.get();
    const likeColor = this.$likeColor.get();
    const colorScheme = this.$colorScheme.get();
    if (highlightColor === getDefaultHighlightColor()) {
      localStorage.removeItem("theme-highlightColorv2");
    } else {
      localStorage.setItem("theme-highlightColorv2", highlightColor);
    }
    if (likeColor === getDefaultLikeColor()) {
      localStorage.removeItem("theme-likeColor");
    } else {
      localStorage.setItem("theme-likeColor", likeColor);
    }
    if (colorScheme === getDefaultColorScheme()) {
      localStorage.removeItem("theme-colorScheme");
    } else {
      localStorage.setItem("theme-colorScheme", colorScheme);
    }
  }

  static fromLocalStorage() {
    const highlightColor =
      localStorage.getItem("theme-highlightColorv2") ||
      getDefaultHighlightColor();
    const likeColor =
      localStorage.getItem("theme-likeColor") || getDefaultLikeColor();
    const colorScheme =
      localStorage.getItem("theme-colorScheme") || getDefaultColorScheme();
    return new Theme({ highlightColor, likeColor, colorScheme });
  }
}

export const theme = Theme.fromLocalStorage();
