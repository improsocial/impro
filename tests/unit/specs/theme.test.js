import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Theme,
  getDefaultHighlightColor,
  getDefaultLikeColor,
  getDefaultColorScheme,
} from "/js/theme.js";

describe("save", () => {
  it("does not store values that match the defaults", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.save();
    assert.deepEqual(localStorage.getItem("theme-highlightColorv2"), null);
    assert.deepEqual(localStorage.getItem("theme-likeColor"), null);
    assert.deepEqual(localStorage.getItem("theme-colorScheme"), null);
  });

  it("stores values that differ from the defaults", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: "#123456",
      likeColor: "#abcdef",
      colorScheme: "dark",
    });
    theme.save();
    assert.deepEqual(localStorage.getItem("theme-highlightColorv2"), "#123456");
    assert.deepEqual(localStorage.getItem("theme-likeColor"), "#abcdef");
    assert.deepEqual(localStorage.getItem("theme-colorScheme"), "dark");
  });

  it("removes previously-stored values when reset to the default", () => {
    localStorage.clear();
    localStorage.setItem("theme-highlightColorv2", "#123456");
    localStorage.setItem("theme-likeColor", "#abcdef");
    localStorage.setItem("theme-colorScheme", "dark");
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.save();
    assert.deepEqual(localStorage.getItem("theme-highlightColorv2"), null);
    assert.deepEqual(localStorage.getItem("theme-likeColor"), null);
    assert.deepEqual(localStorage.getItem("theme-colorScheme"), null);
  });
});

describe("getDefaultColorScheme", () => {
  it('returns "system"', () => {
    assert.deepEqual(getDefaultColorScheme(), "system");
  });
});

describe("fromLocalStorage", () => {
  it("reads stored values when present", () => {
    localStorage.clear();
    localStorage.setItem("theme-highlightColorv2", "#111111");
    localStorage.setItem("theme-likeColor", "#222222");
    localStorage.setItem("theme-colorScheme", "dark");
    const theme = Theme.fromLocalStorage();
    assert.deepEqual(theme.$highlightColor.get(), "#111111");
    assert.deepEqual(theme.$likeColor.get(), "#222222");
    assert.deepEqual(theme.$colorScheme.get(), "dark");
  });

  it("falls back to defaults when nothing is stored", () => {
    localStorage.clear();
    const theme = Theme.fromLocalStorage();
    assert.deepEqual(theme.$highlightColor.get(), getDefaultHighlightColor());
    assert.deepEqual(theme.$likeColor.get(), getDefaultLikeColor());
    assert.deepEqual(theme.$colorScheme.get(), getDefaultColorScheme());
  });
});

describe("update methods", () => {
  it("updateHighlightColor sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateHighlightColor("#abcdef");
    assert.deepEqual(theme.$highlightColor.get(), "#abcdef");
    assert.deepEqual(localStorage.getItem("theme-highlightColorv2"), "#abcdef");
  });

  it("updateLikeColor sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateLikeColor("#abcdef");
    assert.deepEqual(theme.$likeColor.get(), "#abcdef");
    assert.deepEqual(localStorage.getItem("theme-likeColor"), "#abcdef");
  });

  it("updateColorScheme sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateColorScheme("light");
    assert.deepEqual(theme.$colorScheme.get(), "light");
    assert.deepEqual(localStorage.getItem("theme-colorScheme"), "light");
  });
});

describe("apply", () => {
  it("sets CSS custom properties on the root element", () => {
    const theme = new Theme({
      highlightColor: "#abcdef",
      likeColor: "#fedcba",
      colorScheme: "dark",
    });
    theme.apply();
    assert.deepEqual(
      document.documentElement.style.getPropertyValue("--highlight-color"),
      "#abcdef",
    );
    assert.deepEqual(
      document.documentElement.style.getPropertyValue("--like-color"),
      "#fedcba",
    );
    assert.deepEqual(
      document.documentElement.style.getPropertyValue("color-scheme"),
      "dark",
    );
  });

  it('expands "system" color scheme to "light dark"', () => {
    const theme = new Theme({
      highlightColor: "#abcdef",
      likeColor: "#fedcba",
      colorScheme: "system",
    });
    theme.apply();
    assert.deepEqual(
      document.documentElement.style.getPropertyValue("color-scheme"),
      "light dark",
    );
  });

  it("creates a theme-color meta tag if missing", () => {
    document.querySelector("meta[name='theme-color']")?.remove();
    const theme = new Theme({
      highlightColor: "#abcdef",
      likeColor: "#fedcba",
      colorScheme: "light",
    });
    theme.apply();
    const meta = document.querySelector("meta[name='theme-color']");
    assert.deepEqual(meta !== null, true);
  });
});
