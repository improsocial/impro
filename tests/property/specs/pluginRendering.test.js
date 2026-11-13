import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

const RENDERABLE_HTML_TAGS = new Set([
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "code",
  "pre",
  "br",
  "hr",
  "button",
  "input",
  "select",
  "option",
  "label",
  "textarea",
  "a",
  "plugin-profiles-list",
  "plugin-posts-feed",
  "app-icon",
  "plugin-blob-image",
  "toggle-switch",
]);

const RENDERABLE_SVG_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc",
]);

const tagArbitrary = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.constantFrom(
      "div",
      "span",
      "p",
      "a",
      "button",
      "input",
      "ul",
      "li",
      "svg",
      "g",
      "path",
      "toggle-switch",
      "plugin-icon",
    ),
  },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      "script",
      "iframe",
      "style",
      "img",
      "object",
      "foreignObject",
      "DIV",
      "SVG",
      "",
    ),
  },
  { weight: 1, arbitrary: fc.jsonValue() },
);

const attrNameArbitrary = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.constantFrom(
      "class",
      "id",
      "title",
      "href",
      "value",
      "checked",
      "type",
      "data-x",
      "aria-label",
      "viewBox",
      "d",
      "fill",
    ),
  },
  {
    weight: 3,
    arbitrary: fc.constantFrom(
      "rel",
      "target",
      "style",
      "src",
      "srcdoc",
      "onclick",
      "onerror",
      "ONCLICK",
      "xlink:href",
      "data- x",
      "data-<x>",
      "aria-=",
      "data-",
    ),
  },
  { weight: 1, arbitrary: fc.string({ maxLength: 6 }) },
);

const attrValueArbitrary = fc.oneof(
  fc.constantFrom(
    "x",
    "",
    "https://example.com/",
    "http://example.com/",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,x",
    "/relative",
    "url(https://example.com/x.png)",
    "_self",
    "opener",
  ),
  fc.string({ maxLength: 6 }),
  fc.jsonValue(),
);

const styleNameArbitrary = fc.constantFrom(
  "color",
  "width",
  "background-color",
  "background-image",
  "--custom",
  "",
  "not a property",
);

const styleValueArbitrary = fc.oneof(
  fc.constantFrom(
    "red",
    "10px",
    "red !important",
    "url(https://example.com/x.png)",
    "image-set('https://example.com/x.png' 1x)",
    "",
  ),
  fc.integer({ min: 0, max: 20 }),
  fc.jsonValue(),
);

const eventsArbitrary = fc.oneof(
  fc.dictionary(
    fc.constantFrom("click", "change", "input", "mouseover", "error"),
    fc.oneof(fc.string({ maxLength: 4 }), fc.jsonValue()),
    { maxKeys: 3 },
  ),
  fc.jsonValue(),
);

function optional(arbitrary) {
  return fc.option(arbitrary, { nil: undefined });
}

function dropUndefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

const { node: nodeArbitrary } = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    { weight: 3, arbitrary: tie("text") },
    { weight: 1, arbitrary: fc.jsonValue() },
    { weight: 5, arbitrary: tie("element") },
    { weight: 2, arbitrary: tie("legacyElement") },
  ),
  text: fc.record({
    type: fc.constant("text"),
    value: fc.oneof(fc.string({ maxLength: 6 }), fc.jsonValue()),
  }),
  elementFields: fc
    .record({
      tag: optional(tagArbitrary),
      attrs: optional(
        fc.oneof(
          fc.dictionary(attrNameArbitrary, attrValueArbitrary, { maxKeys: 4 }),
          fc.jsonValue(),
        ),
      ),
      styles: optional(
        fc.oneof(
          fc.dictionary(styleNameArbitrary, styleValueArbitrary, {
            maxKeys: 3,
          }),
          fc.jsonValue(),
        ),
      ),
      events: optional(eventsArbitrary),
      children: optional(
        fc.oneof(fc.array(tie("node"), { maxLength: 4 }), fc.jsonValue()),
      ),
    })
    .map(dropUndefined),
  element: tie("elementFields").map((fields) => ({
    type: "element",
    ...fields,
  })),
  legacyElement: fc
    .tuple(
      tie("elementFields"),
      optional(fc.oneof(fc.string({ maxLength: 6 }), fc.jsonValue())),
    )
    .map(([fields, text]) => dropUndefined({ ...fields, text })),
}));

const elementDetailsArbitrary = fc
  .record({
    attrs: optional(
      fc.dictionary(attrNameArbitrary, attrValueArbitrary, { maxKeys: 4 }),
    ),
    styles: optional(
      fc.dictionary(styleNameArbitrary, styleValueArbitrary, { maxKeys: 3 }),
    ),
    events: optional(eventsArbitrary),
  })
  .map(dropUndefined);

function makeRenderer() {
  return new PluginRenderer({ handleNodeEvent() {} }, "property-test");
}

function allElements(root) {
  if (root.nodeType !== 1) return [];
  return [root, ...root.querySelectorAll("*")];
}

function assertSafeDom(root) {
  for (const element of allElements(root)) {
    const tag = element.localName;
    if (element.namespaceURI === SVG_NS) {
      assert(RENDERABLE_SVG_TAGS.has(tag), `unexpected SVG tag <${tag}>`);
    } else {
      assert.deepEqual(element.namespaceURI, HTML_NS);
      assert(RENDERABLE_HTML_TAGS.has(tag), `unexpected tag <${tag}>`);
    }
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      assert(!name.startsWith("on"), `event handler attribute ${name}`);
      assert(!["src", "srcdoc", "xlink:href"].includes(name));
      if (name === "href") {
        assert.deepEqual(new URL(attribute.value).protocol, "https:");
      }
    }
    if (tag === "a" && element.namespaceURI === HTML_NS) {
      assert.deepEqual(element.getAttribute("target"), "_blank");
      assert.deepEqual(element.getAttribute("rel"), "noopener noreferrer");
    }
  }
}

// Attribute order, declaration order within `style`, and a leftover empty
// `style=""` don't affect rendering.
function serializeAttribute(attribute) {
  const value =
    attribute.name === "style"
      ? attribute.value
          .split(";")
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .sort()
          .join("; ")
      : attribute.value;
  return `${attribute.name}=${JSON.stringify(value)}`;
}

function serialize(node) {
  if (node.nodeType !== 1) return JSON.stringify(node.nodeValue);
  const attributes = [...node.attributes]
    .filter((attribute) => !(attribute.name === "style" && !attribute.value))
    .map(serializeAttribute)
    .sort();
  const children = [...node.childNodes].map(serialize);
  return `<${node.namespaceURI}|${node.localName} ${attributes.join(" ")}>[${children.join(",")}]`;
}

describe("PluginRenderer properties", () => {
  beforeEach(() => {
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("renders any JSON payload without throwing", () => {
    fc.assert(
      fc.property(fc.oneof(nodeArbitrary, fc.jsonValue()), (rawNode) => {
        const element = makeRenderer().createRoot().render(rawNode);
        assert(element.nodeType === 1 || element.nodeType === 3);
      }),
      { numRuns: 1000 },
    );
  });

  it("only ever produces allowlisted elements and safe attributes", () => {
    fc.assert(
      fc.property(nodeArbitrary, (rawNode) => {
        assertSafeDom(makeRenderer().createRoot().render(rawNode));
      }),
      { numRuns: 1000 },
    );
  });

  it("patching one element's details gives the same DOM as rendering it fresh", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("div", "a", "input", "button", "svg", "toggle-switch"),
        fc.array(elementDetailsArbitrary, { minLength: 2, maxLength: 4 }),
        (tag, detailsSequence) => {
          const renderer = makeRenderer();
          const root = renderer.createRoot();
          let patched = null;
          for (const details of detailsSequence) {
            patched = root.render({ type: "element", tag, ...details });
          }
          const fresh = renderer
            .createRoot()
            .render({ type: "element", tag, ...detailsSequence.at(-1) });
          assertSafeDom(patched);
          assert.deepEqual(serialize(patched), serialize(fresh));
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("patching to a new tree gives the same DOM as rendering it fresh", () => {
    fc.assert(
      fc.property(
        fc.array(nodeArbitrary, { minLength: 2, maxLength: 4 }),
        (rawNodes) => {
          const renderer = makeRenderer();
          const root = renderer.createRoot();
          let patched = null;
          for (const rawNode of rawNodes) {
            patched = root.render(rawNode);
          }
          const fresh = renderer.createRoot().render(rawNodes.at(-1));
          assertSafeDom(patched);
          assert.deepEqual(serialize(patched), serialize(fresh));
        },
      ),
      { numRuns: 1000 },
    );
  });
});
