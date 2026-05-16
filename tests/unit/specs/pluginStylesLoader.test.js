import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  PluginStylesLoader,
  validatePluginCss,
} from "/js/plugins/pluginStylesLoader.js";

// JSDOM doesn't support constructible stylesheets or adoptedStyleSheets, so we
// install minimal fakes that mirror just the surface the loader touches:
// `new CSSStyleSheet()`, `replaceSync`, iterating `cssRules`, the at-rule
// classes used in `instanceof` checks, and `document.adoptedStyleSheets`.

class FakeStyle {
  constructor(props) {
    this._props = props;
  }
  *[Symbol.iterator]() {
    for (const prop of Object.keys(this._props)) yield prop;
  }
  getPropertyValue(prop) {
    return this._props[prop] ?? "";
  }
}

class FakeRule {
  constructor({ style = null, cssRules = [] } = {}) {
    this.style = style;
    this.cssRules = cssRules;
  }
}
class FakeCSSImportRule extends FakeRule {}
class FakeCSSFontFaceRule extends FakeRule {}
class FakeCSSNamespaceRule extends FakeRule {}

function parseFakeCss(text) {
  const rules = [];
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index++;
    if (index >= text.length) break;
    if (text.startsWith("@import", index)) {
      const end = text.indexOf(";", index);
      rules.push(new FakeCSSImportRule());
      index = end + 1;
    } else if (text.startsWith("@font-face", index)) {
      const end = text.indexOf("}", index);
      rules.push(new FakeCSSFontFaceRule());
      index = end + 1;
    } else if (text.startsWith("@namespace", index)) {
      const end = text.indexOf(";", index);
      rules.push(new FakeCSSNamespaceRule());
      index = end + 1;
    } else {
      const open = text.indexOf("{", index);
      const close = text.indexOf("}", open);
      const body = text.slice(open + 1, close);
      const props = {};
      for (const declaration of body.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon < 0) continue;
        const prop = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();
        if (prop) props[prop] = value;
      }
      rules.push(new FakeRule({ style: new FakeStyle(props) }));
      index = close + 1;
    }
  }
  return rules;
}

class FakeCSSStyleSheet {
  constructor() {
    this.cssRules = [];
  }
  replaceSync(text) {
    this.cssRules = parseFakeCss(text);
  }
}

function stubCssEnv() {
  const originals = {
    CSSStyleSheet: globalThis.CSSStyleSheet,
    CSSImportRule: globalThis.CSSImportRule,
    CSSFontFaceRule: globalThis.CSSFontFaceRule,
    CSSNamespaceRule: globalThis.CSSNamespaceRule,
  };
  globalThis.CSSStyleSheet = FakeCSSStyleSheet;
  globalThis.CSSImportRule = FakeCSSImportRule;
  globalThis.CSSFontFaceRule = FakeCSSFontFaceRule;
  globalThis.CSSNamespaceRule = FakeCSSNamespaceRule;

  const originalAdopted = Object.getOwnPropertyDescriptor(
    globalThis.document,
    "adoptedStyleSheets",
  );
  let adopted = [];
  Object.defineProperty(globalThis.document, "adoptedStyleSheets", {
    configurable: true,
    get() {
      return adopted;
    },
    set(value) {
      adopted = value;
    },
  });

  return {
    get adoptedStyleSheets() {
      return adopted;
    },
    restore() {
      globalThis.CSSStyleSheet = originals.CSSStyleSheet;
      globalThis.CSSImportRule = originals.CSSImportRule;
      globalThis.CSSFontFaceRule = originals.CSSFontFaceRule;
      globalThis.CSSNamespaceRule = originals.CSSNamespaceRule;
      if (originalAdopted) {
        Object.defineProperty(
          globalThis.document,
          "adoptedStyleSheets",
          originalAdopted,
        );
      } else {
        delete globalThis.document.adoptedStyleSheets;
      }
    },
  };
}

function expectThrow(fn, messageFragment) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert(caught, `expected ${fn} to throw`);
  assert(
    caught.message.includes(messageFragment),
    `expected error "${caught.message}" to include "${messageFragment}"`,
  );
}

const t = new TestSuite("pluginStylesLoader");

t.describe("validatePluginCss", (it, { beforeEach, afterEach }) => {
  let env;
  beforeEach(() => {
    env = stubCssEnv();
  });
  afterEach(() => env.restore());

  it("returns a stylesheet for valid CSS", () => {
    const sheet = validatePluginCss(".plugin { color: red; }");
    assert(sheet instanceof FakeCSSStyleSheet);
    assertEquals(sheet.cssRules.length, 1);
  });

  it("rejects @import rules", () => {
    expectThrow(
      () => validatePluginCss('@import url("evil.css");'),
      "@import not allowed",
    );
  });

  it("rejects @font-face rules", () => {
    expectThrow(
      () =>
        validatePluginCss("@font-face { font-family: x; src: local('x'); }"),
      "@font-face not allowed",
    );
  });

  it("rejects @namespace rules", () => {
    expectThrow(
      () => validatePluginCss('@namespace svg url("http://example.test");'),
      "@namespace not allowed",
    );
  });

  it("rejects url() in declarations", () => {
    expectThrow(
      () =>
        validatePluginCss(
          '.plugin { background: url("https://evil.test/x.png"); }',
        ),
      "disallowed url() in background",
    );
  });

  it("rejects image-set() in declarations", () => {
    expectThrow(
      () =>
        validatePluginCss(
          '.plugin { background: image-set("a.png" 1x, "b.png" 2x); }',
        ),
      "disallowed url() in background",
    );
  });
});

t.describe("PluginStylesLoader.mount", (it, { beforeEach, afterEach }) => {
  let env;
  beforeEach(() => {
    env = stubCssEnv();
  });
  afterEach(() => env.restore());

  it("adopts a sheet for the plugin", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    assertEquals(env.adoptedStyleSheets.length, 1);
  });

  it("appends sheets for multiple plugins without dropping prior ones", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    loader.mount("plugin-b", ".b { color: blue; }");
    assertEquals(env.adoptedStyleSheets.length, 2);
  });

  it("replaces a prior sheet when the same plugin mounts twice", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    const firstSheet = env.adoptedStyleSheets[0];
    loader.mount("plugin-a", ".a { color: green; }");
    assertEquals(env.adoptedStyleSheets.length, 1);
    assert(env.adoptedStyleSheets[0] !== firstSheet);
  });

  it("throws and does not adopt when CSS is invalid", () => {
    const loader = new PluginStylesLoader();
    expectThrow(
      () => loader.mount("plugin-a", '@import url("x.css");'),
      "@import not allowed",
    );
    assertEquals(env.adoptedStyleSheets.length, 0);
  });
});

t.describe("PluginStylesLoader.unmount", (it, { beforeEach, afterEach }) => {
  let env;
  beforeEach(() => {
    env = stubCssEnv();
  });
  afterEach(() => env.restore());

  it("removes only the named plugin's sheet", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    loader.mount("plugin-b", ".b { color: blue; }");
    const sheetB = env.adoptedStyleSheets[1];
    loader.unmount("plugin-a");
    assertEquals(env.adoptedStyleSheets.length, 1);
    assert(env.adoptedStyleSheets[0] === sheetB);
  });

  it("is a no-op for unknown plugin ids", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    loader.unmount("plugin-missing");
    assertEquals(env.adoptedStyleSheets.length, 1);
  });

  it("allows remounting a plugin after unmount", () => {
    const loader = new PluginStylesLoader();
    loader.mount("plugin-a", ".a { color: red; }");
    loader.unmount("plugin-a");
    assertEquals(env.adoptedStyleSheets.length, 0);
    loader.mount("plugin-a", ".a { color: green; }");
    assertEquals(env.adoptedStyleSheets.length, 1);
  });
});

await t.run();
