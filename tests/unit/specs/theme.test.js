import { TestSuite } from "../testSuite.js";
import { assertEquals } from "../testHelpers.js";
import {
  Theme,
  getDefaultHighlightColor,
  getDefaultLikeColor,
  getDefaultColorScheme,
} from "/js/theme.js";

const t = new TestSuite("theme");

t.describe("save", (it) => {
  it("does not store values that match the defaults", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.save();
    assertEquals(localStorage.getItem("theme-highlightColorv2"), null);
    assertEquals(localStorage.getItem("theme-likeColor"), null);
    assertEquals(localStorage.getItem("theme-colorScheme"), null);
  });

  it("stores values that differ from the defaults", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: "#123456",
      likeColor: "#abcdef",
      colorScheme: "dark",
    });
    theme.save();
    assertEquals(localStorage.getItem("theme-highlightColorv2"), "#123456");
    assertEquals(localStorage.getItem("theme-likeColor"), "#abcdef");
    assertEquals(localStorage.getItem("theme-colorScheme"), "dark");
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
    assertEquals(localStorage.getItem("theme-highlightColorv2"), null);
    assertEquals(localStorage.getItem("theme-likeColor"), null);
    assertEquals(localStorage.getItem("theme-colorScheme"), null);
  });
});

t.describe("getDefaultColorScheme", (it) => {
  it('returns "system"', () => {
    assertEquals(getDefaultColorScheme(), "system");
  });
});

t.describe("fromLocalStorage", (it) => {
  it("reads stored values when present", () => {
    localStorage.clear();
    localStorage.setItem("theme-highlightColorv2", "#111111");
    localStorage.setItem("theme-likeColor", "#222222");
    localStorage.setItem("theme-colorScheme", "dark");
    const theme = Theme.fromLocalStorage();
    assertEquals(theme.highlightColor, "#111111");
    assertEquals(theme.likeColor, "#222222");
    assertEquals(theme.colorScheme, "dark");
  });

  it("falls back to defaults when nothing is stored", () => {
    localStorage.clear();
    const theme = Theme.fromLocalStorage();
    assertEquals(theme.highlightColor, getDefaultHighlightColor());
    assertEquals(theme.likeColor, getDefaultLikeColor());
    assertEquals(theme.colorScheme, getDefaultColorScheme());
  });
});

t.describe("update methods", (it) => {
  it("updateHighlightColor sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateHighlightColor("#abcdef");
    assertEquals(theme.highlightColor, "#abcdef");
    assertEquals(localStorage.getItem("theme-highlightColorv2"), "#abcdef");
  });

  it("updateLikeColor sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateLikeColor("#abcdef");
    assertEquals(theme.likeColor, "#abcdef");
    assertEquals(localStorage.getItem("theme-likeColor"), "#abcdef");
  });

  it("updateColorScheme sets the value and persists it", () => {
    localStorage.clear();
    const theme = new Theme({
      highlightColor: getDefaultHighlightColor(),
      likeColor: getDefaultLikeColor(),
      colorScheme: getDefaultColorScheme(),
    });
    theme.updateColorScheme("light");
    assertEquals(theme.colorScheme, "light");
    assertEquals(localStorage.getItem("theme-colorScheme"), "light");
  });
});

t.describe("apply", (it) => {
  it("sets CSS custom properties on the root element", () => {
    const theme = new Theme({
      highlightColor: "#abcdef",
      likeColor: "#fedcba",
      colorScheme: "dark",
    });
    theme.apply();
    assertEquals(
      document.documentElement.style.getPropertyValue("--highlight-color"),
      "#abcdef",
    );
    assertEquals(
      document.documentElement.style.getPropertyValue("--like-color"),
      "#fedcba",
    );
    assertEquals(
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
    assertEquals(
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
    assertEquals(meta !== null, true);
  });
});

await t.run();
