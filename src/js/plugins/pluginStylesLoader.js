const URL_FUNC_RE =
  /\b(?:url|image-set|-webkit-image-set|image|cross-fade|element)\s*\(/i;

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
        if (URL_FUNC_RE.test(rule.style.getPropertyValue(prop))) {
          throw new Error(`disallowed url() in ${prop}`);
        }
      }
    }

    if (rule.cssRules) walk(rule.cssRules);
  }
}

export class PluginStylesLoader {
  constructor() {
    this._sheets = new Map();
  }

  mount(pluginId, cssText) {
    if (this._sheets.has(pluginId)) this.unmount(pluginId);
    const sheet = validatePluginCss(cssText);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    this._sheets.set(pluginId, sheet);
  }

  unmount(pluginId) {
    const sheet = this._sheets.get(pluginId);
    if (!sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (entry) => entry !== sheet,
    );
    this._sheets.delete(pluginId);
  }
}
