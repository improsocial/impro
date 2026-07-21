const URL_FUNC_RE =
  /\b(?:url|image-set|-webkit-image-set|image|cross-fade|element)\s*\(/i;

export function assertSafeCssValue(property, value) {
  if (URL_FUNC_RE.test(value)) {
    throw new Error(`disallowed url() in ${property}`);
  }
}

export function assertSafeInlineStyleValue(property, value) {
  // Reject any backslash so a CSS-escape-encoded identifier (e.g. `\75rl(...)`)
  // can't slip past URL_FUNC_RE
  if (value.includes("\\")) {
    throw new Error(`disallowed escape in ${property}`);
  }
  assertSafeCssValue(property, value);
}

export function validatePluginCss(text) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  walk(sheet.cssRules);
  return sheet;
}

function walk(rules) {
  for (const rule of rules) {
    if (rule instanceof CSSImportRule) throw new Error("@import not allowed");
    if (rule instanceof CSSFontFaceRule)
      throw new Error("@font-face not allowed");
    if (rule instanceof CSSNamespaceRule)
      throw new Error("@namespace not allowed");

    if (rule.style) {
      for (const prop of rule.style) {
        assertSafeCssValue(prop, rule.style.getPropertyValue(prop));
      }
    }

    if (rule.cssRules) walk(rule.cssRules);
  }
}

function cssStringLiteral(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const FONT_STYLES = new Set(["normal", "italic", "oblique"]);
const FONT_WEIGHT_KEYWORDS = new Set(["normal", "bold"]);

function isValidFontWeightNumber(value) {
  if (!/^\d{1,4}$/.test(value)) return false;
  const num = Number(value);
  return num >= 1 && num <= 1000;
}

function isValidFontWeight(value) {
  if (typeof value !== "string") return false;
  if (FONT_WEIGHT_KEYWORDS.has(value)) return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return isValidFontWeightNumber(parts[0]);
  if (parts.length === 2) {
    return (
      isValidFontWeightNumber(parts[0]) &&
      isValidFontWeightNumber(parts[1]) &&
      Number(parts[0]) <= Number(parts[1])
    );
  }
  return false;
}

function buildFontFaceRule({ family, weight, style, url, file }) {
  const format = /\.woff2$/i.test(file) ? "woff2" : "woff";
  const lines = [
    `font-family: ${cssStringLiteral(family)};`,
    `src: url(${cssStringLiteral(url)}) format(${cssStringLiteral(format)});`,
    `font-weight: ${weight};`,
    `font-style: ${style};`,
  ];
  return `@font-face { ${lines.join(" ")} }`;
}

export class PluginStylesLoader {
  constructor() {
    this._manifestSheets = new Map();
    this._snippetSheets = new Map();
    this._fontSheets = new Map();
    this._fontUrls = new Map();
  }

  mountFonts(pluginId, descriptors) {
    if (!descriptors || descriptors.length === 0) {
      this._unmountFonts(pluginId);
      return;
    }
    const normalized = descriptors.map((desc, i) => {
      const weight = desc.weight ?? "400";
      const style = desc.style ?? "normal";
      if (!isValidFontWeight(weight)) {
        throw new Error(`fonts[${i}] invalid weight "${weight}"`);
      }
      if (!FONT_STYLES.has(style)) {
        throw new Error(`fonts[${i}] invalid style "${style}"`);
      }
      return { ...desc, weight, style };
    });
    this._unmountFonts(pluginId);
    const urls = [];
    const ruleTexts = [];
    for (const desc of normalized) {
      const url = URL.createObjectURL(desc.blob);
      urls.push(url);
      ruleTexts.push(
        buildFontFaceRule({
          family: desc.family,
          weight: desc.weight,
          style: desc.style,
          url,
          file: desc.file,
        }),
      );
    }
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(ruleTexts.join("\n"));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    this._fontSheets.set(pluginId, sheet);
    this._fontUrls.set(pluginId, urls);
  }

  _unmountFonts(pluginId) {
    const sheet = this._fontSheets.get(pluginId);
    if (sheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (entry) => entry !== sheet,
      );
      this._fontSheets.delete(pluginId);
    }
    const urls = this._fontUrls.get(pluginId);
    if (urls) {
      for (const url of urls) URL.revokeObjectURL(url);
      this._fontUrls.delete(pluginId);
    }
  }

  mount(pluginId, cssText) {
    if (this._manifestSheets.has(pluginId)) this._unmountManifest(pluginId);
    const sheet = validatePluginCss(cssText);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    this._manifestSheets.set(pluginId, sheet);
  }

  unmount(pluginId) {
    this._unmountManifest(pluginId);
    const snippets = this._snippetSheets.get(pluginId);
    if (snippets && snippets.size) {
      const toRemove = new Set(snippets.values());
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (entry) => !toRemove.has(entry),
      );
    }
    this._snippetSheets.delete(pluginId);
    this._unmountFonts(pluginId);
  }

  mountSnippet(pluginId, snippetId, cssText) {
    const sheet = validatePluginCss(cssText);
    let snippets = this._snippetSheets.get(pluginId);
    if (!snippets) {
      snippets = new Map();
      this._snippetSheets.set(pluginId, snippets);
    }
    const existing = snippets.get(snippetId);
    if (existing) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (entry) => entry !== existing,
      );
    }
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    snippets.set(snippetId, sheet);
  }

  unmountSnippet(pluginId, snippetId) {
    const snippets = this._snippetSheets.get(pluginId);
    if (!snippets) return;
    const sheet = snippets.get(snippetId);
    if (!sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (entry) => entry !== sheet,
    );
    snippets.delete(snippetId);
    if (snippets.size === 0) this._snippetSheets.delete(pluginId);
  }

  _unmountManifest(pluginId) {
    const sheet = this._manifestSheets.get(pluginId);
    if (!sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (entry) => entry !== sheet,
    );
    this._manifestSheets.delete(pluginId);
  }
}
