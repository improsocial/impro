import { Capacitor, StatusBar } from "/js/lib/capacitor.js";

function getRootStyle() {
  return getComputedStyle(document.documentElement);
}

export function getDefaultHighlightColor() {
  return getRootStyle().getPropertyValue("--purple");
}

export function getDefaultLikeColor() {
  return getRootStyle().getPropertyValue("--pink");
}

export function getDefaultColorScheme() {
  return "dark";
}

class Theme {
  constructor({ highlightColor, likeColor, colorScheme }) {
    this.highlightColor = highlightColor;
    this.likeColor = likeColor;
    this.colorScheme = colorScheme;
  }

  getBackgroundColor() {
    return getRootStyle().getPropertyValue("--background-color");
  }

  updateHighlightColor(highlightColor) {
    this.highlightColor = highlightColor;
    this.apply();
    this.save();
  }

  updateLikeColor(likeColor) {
    this.likeColor = likeColor;
    this.apply();
    this.save();
  }

  updateColorScheme(colorScheme) {
    this.colorScheme = colorScheme;
    this.apply();
    this.save();
  }

  apply() {
    document.documentElement.style.setProperty(
      `--highlight-color`,
      this.highlightColor
    );
    document.documentElement.style.setProperty(`--like-color`, this.likeColor);
    // Apply color scheme
    if (this.colorScheme === "system") {
      document.documentElement.style.setProperty("color-scheme", "light dark");
    } else {
      document.documentElement.style.setProperty(
        "color-scheme",
        this.colorScheme
      );
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
    localStorage.setItem("theme-highlightColor", this.highlightColor);
    localStorage.setItem("theme-likeColor", this.likeColor);
    localStorage.setItem("theme-colorScheme", this.colorScheme);
  }

  static fromLocalStorage() {
    const highlightColor =
      localStorage.getItem("theme-highlightColor") ||
      getDefaultHighlightColor();
    const likeColor =
      localStorage.getItem("theme-likeColor") || getDefaultLikeColor();
    const colorScheme =
      localStorage.getItem("theme-colorScheme") || getDefaultColorScheme();
    return new Theme({ highlightColor, likeColor, colorScheme });
  }
}

export const theme = Theme.fromLocalStorage();
