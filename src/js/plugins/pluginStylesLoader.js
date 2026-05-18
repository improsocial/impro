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
    this._manifestSheets = new Map();
    this._snippetSheets = new Map();
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
