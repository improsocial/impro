import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

function makeBridge() {
  const calls = [];
  const bridge = {
    handleNodeEvent(pluginId, handlerId, event) {
      calls.push({ pluginId, handlerId, event });
    },
  };
  return { bridge, calls };
}

describe("PluginRenderer:render with fresh roots", () => {
  it("creates a fresh element when given a fresh root each call", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const node = { tag: "div", attrs: { class: "x" }, text: "hi" };
    const first = renderer.createRoot().render(node);
    const second = renderer.createRoot().render(node);
    assert(first !== second);
    assert.deepEqual(first.textContent, "hi");
    assert.deepEqual(first.getAttribute("class"), "x");
  });

  it("renders <toggle-switch> directly", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({ tag: "toggle-switch" });
    assert.deepEqual(element.tagName.toLowerCase(), "toggle-switch");
  });

  it("renders <input type=checkbox> as a real checkbox", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer
      .createRoot()
      .render({ tag: "input", attrs: { type: "checkbox" } });
    assert.deepEqual(element.tagName.toLowerCase(), "input");
    assert.deepEqual(element.getAttribute("type"), "checkbox");
  });

  it("renders <plugin-profiles-list> and passes dataLayer", () => {
    const { bridge } = makeBridge();
    const dataLayer = {
      declarative: { ensureDetailedProfiles: async () => [] },
    };
    const renderer = new PluginRenderer(bridge, "demo", { dataLayer });
    const element = renderer.createRoot().render({
      tag: "plugin-profiles-list",
      attrs: { dids: "did:test:a,did:test:b" },
    });
    assert.deepEqual(element.tagName.toLowerCase(), "plugin-profiles-list");
    assert.deepEqual(element.getAttribute("dids"), "did:test:a,did:test:b");
    assert(element.dataLayer === dataLayer);
  });

  it("drops disallowed attributes from <plugin-profiles-list>", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo", { dataLayer: {} });
    const element = renderer.createRoot().render({
      tag: "plugin-profiles-list",
      attrs: { dids: "did:test:a", onclick: "alert(1)" },
    });
    assert(!element.hasAttribute("onclick"));
  });

  it("throws when rendering <plugin-profiles-list> without a dataLayer", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    let error = null;
    try {
      renderer.createRoot().render({
        tag: "plugin-profiles-list",
        attrs: { dids: "did:test:a" },
      });
    } catch (e) {
      error = e;
    }
    assert(error !== null);
    assert(error.message.includes("dataLayer"));
  });
});

describe("PluginRenderer:root reconciliation", () => {
  it("returns the same element across renders when the tag matches", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const first = root.render({ tag: "div", text: "a" });
    const second = root.render({ tag: "div", text: "b" });
    assert(first === second);
    assert.deepEqual(second.textContent, "b");
  });

  it("replaces the element when the tag changes", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const first = root.render({ tag: "div" });
    const second = root.render({ tag: "span" });
    assert(first !== second);
    assert.deepEqual(second.tagName.toLowerCase(), "span");
  });

  it("patches attributes in place", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "input",
      attrs: { type: "text", value: "one", placeholder: "old" },
    });
    root.render({
      tag: "input",
      attrs: { type: "text", value: "two" },
    });
    assert.deepEqual(element.getAttribute("value"), "two");
    assert(!element.hasAttribute("placeholder"));
  });

  it("preserves the value of a focused input across re-render", () => {
    document.body.innerHTML = "";
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const input = root.render({
      tag: "input",
      attrs: { type: "text", value: "initial" },
    });
    document.body.appendChild(input);
    input.focus();
    input.value = "user-typed";
    root.render({
      tag: "input",
      attrs: { type: "text", value: "stale-from-worker" },
    });
    assert.deepEqual(input.value, "user-typed");
    assert(document.activeElement === input);
  });

  it("preserves a dirty input's live value across an ordinary re-render", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const input = root.render({
      tag: "input",
      attrs: { type: "text", value: "default" },
    });
    // User edits the field (dirties the control); a patch must not clobber it.
    input.value = "user-edited";
    root.render({
      tag: "input",
      attrs: { type: "text", value: "default" },
    });
    assert.deepEqual(input.value, "user-edited");
  });

  it("rebuilds a fresh element after reset(), discarding dirty state", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const input = root.render({
      tag: "input",
      attrs: { type: "text", value: "default" },
    });
    input.value = "user-edited";
    root.reset();
    const rebuilt = root.render({
      tag: "input",
      attrs: { type: "text", value: "default" },
    });
    assert(rebuilt !== input);
    assert.deepEqual(rebuilt.value, "default");
  });

  it("reuses matching children and patches their text in place", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "div",
      children: [
        { tag: "span", text: "one" },
        { tag: "span", text: "two" },
      ],
    });
    const firstChild = element.children[0];
    const secondChild = element.children[1];
    root.render({
      tag: "div",
      children: [
        { tag: "span", text: "ONE" },
        { tag: "span", text: "two" },
      ],
    });
    assert(element.children[0] === firstChild);
    assert(element.children[1] === secondChild);
    assert.deepEqual(firstChild.textContent, "ONE");
  });

  it("appends new children and removes dropped ones", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "div",
      children: [{ tag: "span", text: "a" }],
    });
    root.render({
      tag: "div",
      children: [
        { tag: "span", text: "a" },
        { tag: "span", text: "b" },
      ],
    });
    assert.deepEqual(element.children.length, 2);
    root.render({ tag: "div", children: [] });
    assert.deepEqual(element.children.length, 0);
  });

  it("dispatches the updated handlerId after a re-render without leaking listeners", () => {
    const { bridge, calls } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const button = root.render({
      tag: "button",
      events: { click: "h1" },
    });
    root.render({ tag: "button", events: { click: "h2" } });
    button.dispatchEvent(new Event("click"));
    assert.deepEqual(calls.length, 1);
    assert.deepEqual(calls[0].handlerId, "h2");
  });

  it("stops dispatching when an event handler is removed", () => {
    const { bridge, calls } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const button = root.render({
      tag: "button",
      events: { click: "h1" },
    });
    root.render({ tag: "button" });
    button.dispatchEvent(new Event("click"));
    assert.deepEqual(calls.length, 0);
  });

  it("clears stale text when the new node has neither text nor children", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({ tag: "div", text: "hi" });
    root.render({ tag: "div" });
    assert.deepEqual(element.textContent, "");
  });

  it("renders both text and children with text as a leading text node", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "button",
      text: "Applying",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    assert.deepEqual(element.childNodes.length, 2);
    assert.deepEqual(element.firstChild.nodeType, 3);
    assert.deepEqual(element.firstChild.textContent, "Applying");
    assert.deepEqual(element.children.length, 1);
    assert.deepEqual(element.children[0].tagName.toLowerCase(), "div");
    assert.deepEqual(
      element.children[0].getAttribute("class"),
      "loading-spinner",
    );
  });

  it("patches from text-only to text-plus-children, preserving spinner child", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({ tag: "button", text: "Apply" });
    assert.deepEqual(element.textContent, "Apply");
    root.render({
      tag: "button",
      text: "Applying",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    assert.deepEqual(element.children.length, 1);
    assert.deepEqual(element.firstChild.nodeType, 3);
    assert.deepEqual(element.firstChild.textContent, "Applying");
    assert.deepEqual(
      element.children[0].getAttribute("class"),
      "loading-spinner",
    );
  });

  it("patches from text-plus-children back to text-only, removing the child", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "button",
      text: "Applying",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    root.render({ tag: "button", text: "Apply" });
    assert.deepEqual(element.children.length, 0);
    assert.deepEqual(element.textContent, "Apply");
  });

  it("updates the leading text node in place when children stay stable", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "button",
      text: "Applying",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    const originalSpinner = element.children[0];
    root.render({
      tag: "button",
      text: "Working",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    assert.deepEqual(element.firstChild.textContent, "Working");
    assert(element.children[0] === originalSpinner);
  });

  it("removes the leading text node while keeping element children", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "button",
      text: "Applying",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    const originalSpinner = element.children[0];
    root.render({
      tag: "button",
      children: [{ tag: "div", attrs: { class: "loading-spinner" } }],
    });
    assert.deepEqual(element.childNodes.length, 1);
    assert.deepEqual(element.children.length, 1);
    assert(element.children[0] === originalSpinner);
  });

  it("replaces a child whose tag no longer matches", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "div",
      children: [{ tag: "span", text: "x" }],
    });
    const oldChild = element.children[0];
    root.render({
      tag: "div",
      children: [{ tag: "button", text: "x" }],
    });
    assert(element.children[0] !== oldChild);
    assert.deepEqual(element.children[0].tagName.toLowerCase(), "button");
  });
});

describe("PluginRenderer:plugin-icon", () => {
  it("renders <plugin-icon> with the icon attribute passed through", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-icon",
      attrs: { icon: "bell" },
    });
    assert.deepEqual(element.tagName.toLowerCase(), "plugin-icon");
    assert.deepEqual(element.getAttribute("icon"), "bell");
  });

  it("drops disallowed attributes from <plugin-icon>", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-icon",
      attrs: { icon: "bell", onclick: "alert(1)" },
    });
    assert(!element.hasAttribute("onclick"));
    assert.deepEqual(element.getAttribute("icon"), "bell");
  });
});

describe("PluginRenderer:plugin-blob-image", () => {
  it("renders <plugin-blob-image> and passes did/cid/alt/cdn-prefix attrs", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-blob-image",
      attrs: {
        did: "did:plc:abc",
        cid: "bafkreiabcdefghijklmnopqrstuvwxyz234567",
        alt: ":blobcat:",
        "cdn-prefix": "feed_thumbnail",
      },
    });
    assert.deepEqual(element.tagName.toLowerCase(), "plugin-blob-image");
    assert.deepEqual(element.getAttribute("did"), "did:plc:abc");
    assert.deepEqual(
      element.getAttribute("cid"),
      "bafkreiabcdefghijklmnopqrstuvwxyz234567",
    );
    assert.deepEqual(element.getAttribute("alt"), ":blobcat:");
    assert.deepEqual(element.getAttribute("cdn-prefix"), "feed_thumbnail");
  });

  it("does not accept src or onclick on <plugin-blob-image>", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-blob-image",
      attrs: {
        did: "did:plc:abc",
        src: "https://evil.example.com/track.gif",
        onclick: "alert(1)",
      },
    });
    assert(!element.hasAttribute("src"));
    assert(!element.hasAttribute("onclick"));
  });

  it("does not allow <img> tags from plugin trees", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "img",
      attrs: { src: "https://evil.example.com/track.gif" },
    });
    // Disallowed tags fall back to <span> and the src attribute is not on the allowlist.
    assert.deepEqual(element.tagName.toLowerCase(), "span");
    assert(!element.hasAttribute("src"));
  });
});

describe("PluginRenderer:custom element observedAttributes", () => {
  it("passes through attrs declared in a custom element's observedAttributes", () => {
    // plugin-icon declares observedAttributes = ["icon"] — verifies the
    // observedAttributes lookup is what allows `icon` through now that it
    // has been removed from the global ALLOWED_ATTRS list.
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-icon",
      attrs: { icon: "bell" },
    });
    assert.deepEqual(element.getAttribute("icon"), "bell");
  });

  it("drops custom attrs that aren't in observedAttributes", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-icon",
      attrs: { icon: "bell", "secret-mode": "on" },
    });
    assert.deepEqual(element.getAttribute("icon"), "bell");
    assert(!element.hasAttribute("secret-mode"));
  });

  it("does not scope a custom attr from one component onto another", () => {
    // `dids` is observed by plugin-profiles-list but not by plugin-icon —
    // it should not leak across tags.
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "plugin-icon",
      attrs: { icon: "bell", dids: "did:test:a" },
    });
    assert(!element.hasAttribute("dids"));
  });

  it("removes a custom attr on patch when it's dropped from the new tree", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "plugin-icon",
      attrs: { icon: "bell" },
    });
    root.render({ tag: "plugin-icon", attrs: {} });
    assert(!element.hasAttribute("icon"));
  });
});

describe("PluginRenderer:custom element refresh", () => {
  it("calls refresh() on custom elements during patch", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const first = root.render({ tag: "plugin-icon" });
    let calls = 0;
    first.refresh = () => {
      calls++;
    };
    root.render({ tag: "plugin-icon" });
    assert.deepEqual(calls, 1);
    root.render({ tag: "plugin-icon" });
    assert.deepEqual(calls, 2);
  });

  it("does not call refresh on built-in tags", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const first = root.render({ tag: "div" });
    let called = false;
    // `refresh` on a plain element should never be invoked.
    first.refresh = () => {
      called = true;
    };
    root.render({ tag: "div" });
    assert.deepEqual(called, false);
  });
});

describe("PluginRenderer:anchor tags", () => {
  it("renders <a> with safe https href and forces target/rel", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "a",
      attrs: { href: "https://example.com/page" },
      text: "click",
    });
    assert.deepEqual(element.tagName.toLowerCase(), "a");
    assert.deepEqual(element.getAttribute("href"), "https://example.com/page");
    assert.deepEqual(element.getAttribute("target"), "_blank");
    assert.deepEqual(element.getAttribute("rel"), "noopener noreferrer");
  });

  it("strips non-https href schemes on create", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    for (const href of [
      "http://example.com",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "mailto:a@b.co",
      "ftp://example.com",
      "//example.com",
      "/relative",
      "not a url",
    ]) {
      const element = renderer
        .createRoot()
        .render({ tag: "a", attrs: { href }, text: "x" });
      assert(!element.hasAttribute("href"), `should reject href: ${href}`);
      assert.deepEqual(element.getAttribute("target"), "_blank");
      assert.deepEqual(element.getAttribute("rel"), "noopener noreferrer");
    }
  });

  it("ignores plugin-supplied target and rel attributes", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "a",
      attrs: {
        href: "https://example.com",
        target: "_self",
        rel: "opener",
      },
    });
    assert.deepEqual(element.getAttribute("target"), "_blank");
    assert.deepEqual(element.getAttribute("rel"), "noopener noreferrer");
  });

  it("shows the external link warning modal when an external <a> is clicked", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const element = renderer.createRoot().render({
      tag: "a",
      attrs: { href: "https://example.com/page" },
      text: "click",
    });
    document.body.appendChild(element);
    const event = new Event("click", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    assert(event.defaultPrevented, "click should be prevented");
    const dialog = document.querySelector(".external-link-warning-modal");
    assert(dialog, "warning modal should be rendered");
    dialog.remove();
    element.remove();
  });

  it("removes href on patch when it becomes unsafe", () => {
    const { bridge } = makeBridge();
    const renderer = new PluginRenderer(bridge, "demo");
    const root = renderer.createRoot();
    const element = root.render({
      tag: "a",
      attrs: { href: "https://example.com/a" },
    });
    root.render({
      tag: "a",
      attrs: { href: "javascript:alert(1)" },
    });
    assert(!element.hasAttribute("href"));
  });
});
