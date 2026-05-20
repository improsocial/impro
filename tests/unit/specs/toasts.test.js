import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { showToast, showPluginToast, hidePluginToast } from "/js/toasts.js";
import { html } from "/js/lib/lit-html.js";

const t = new TestSuite("Toasts");

function clearDOM() {
  document.body.innerHTML = "";
}

t.describe("showToast", (it) => {
  it("should append a toast element with the toast class", async () => {
    clearDOM();
    await showToast("Hello", { timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast !== null);
  });

  it("should render the message text", async () => {
    clearDOM();
    await showToast("Hello world", { timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.textContent.includes("Hello world"));
  });

  it("should use circle-check icon for the default style", async () => {
    clearDOM();
    await showToast("msg", { timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("default"));
    assert(toast.querySelector(".toast-icon .circle-check-icon") !== null);
  });

  it("should use circle-check icon for the success style", async () => {
    clearDOM();
    await showToast("msg", { style: "success", timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("success"));
    assert(toast.querySelector(".toast-icon .circle-check-icon") !== null);
  });

  it("should use alert icon for the error style", async () => {
    clearDOM();
    await showToast("msg", { style: "error", timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("error"));
    assert(toast.querySelector(".toast-icon .alert-icon") !== null);
  });

  it("should use alert icon for the warning style", async () => {
    clearDOM();
    await showToast("msg", { style: "warning", timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("warning"));
    assert(toast.querySelector(".toast-icon .alert-icon") !== null);
  });

  it("should use info icon for the info style", async () => {
    clearDOM();
    await showToast("msg", { style: "info", timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("info"));
    assert(toast.querySelector(".toast-icon .info-icon") !== null);
  });

  it("should fall back to the default icon for an unknown style", async () => {
    clearDOM();
    await showToast("msg", { style: "bogus", timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.querySelector(".toast-icon .circle-check-icon") !== null);
  });

  it("should use the custom iconTemplate when provided", async () => {
    clearDOM();
    const customIconTemplate = () =>
      html`<div class="icon custom-test-icon"></div>`;
    await showToast("msg", { iconTemplate: customIconTemplate, timeout: 0 });
    const toast = document.querySelector(".toast");
    assert(toast.querySelector(".toast-icon .custom-test-icon") !== null);
    // The default style icon should not be rendered when overridden.
    assert(toast.querySelector(".toast-icon .circle-check-icon") === null);
  });

  it("should let custom iconTemplate override a style's default icon", async () => {
    clearDOM();
    const customIconTemplate = () =>
      html`<div class="icon custom-test-icon"></div>`;
    await showToast("msg", {
      style: "error",
      iconTemplate: customIconTemplate,
      timeout: 0,
    });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("error"));
    assert(toast.querySelector(".toast-icon .custom-test-icon") !== null);
    assert(toast.querySelector(".toast-icon .alert-icon") === null);
  });
});

function makePluginRenderer(pluginId = "test-plugin") {
  const calls = [];
  function renderNodeImpl(node) {
    calls.push({ node, pluginId });
    const element = document.createElement(node.tag ?? "div");
    const className = node.attrs?.class;
    if (className) element.className = className;
    if (node.text != null) element.textContent = node.text;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        element.appendChild(renderNodeImpl(child));
      }
    }
    return element;
  }
  const renderer = {
    createRoot() {
      return {
        tree: null,
        el: null,
        render(node) {
          this.el = renderNodeImpl(node);
          this.tree = node;
          return this.el;
        },
      };
    },
    isEmptyNode(node) {
      if (!node) return true;
      if (node.text != null && node.text !== "") return false;
      if (Array.isArray(node.children) && node.children.length > 0)
        return false;
      return true;
    },
  };
  return { renderer, calls };
}

function noticeElNode({ message = "Hello", classes = ["toast"] } = {}) {
  return {
    tag: "div",
    attrs: { class: classes.join(" ") },
    text: message,
    children: [],
    events: {},
  };
}

let nextPluginToastTestId = 0;
function uniqueIds() {
  const id = nextPluginToastTestId++;
  return { pluginId: `test-plugin-${id}`, toastId: id };
}

t.describe("showPluginToast", (it) => {
  it("should render the element via the pluginRenderer and mount it", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer, calls } = makePluginRenderer(pluginId);
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode({ message: "Hi" }),
      timeout: 0,
    });
    const toast = document.querySelector(".toast");
    assert(toast !== null);
    assert(toast.textContent.includes("Hi"));
    assertEquals(calls.length, 1);
    assertEquals(calls[0].pluginId, pluginId);
  });

  it("should set the popover attribute on the toast element", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer } = makePluginRenderer(pluginId);
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode(),
      timeout: 0,
    });
    const toast = document.querySelector(".toast");
    assertEquals(toast.getAttribute("popover"), "manual");
  });

  it("should preserve plugin-supplied classes on the toast", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer } = makePluginRenderer(pluginId);
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode({ classes: ["toast", "error"] }),
      timeout: 0,
    });
    const toast = document.querySelector(".toast");
    assert(toast.classList.contains("toast"));
    assert(toast.classList.contains("error"));
  });

  it("should ignore a second call with the same plugin+toast id", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer, calls } = makePluginRenderer(pluginId);
    const args = {
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode({ message: "First" }),
      timeout: 0,
    };
    showPluginToast(args);
    showPluginToast({ ...args, element: noticeElNode({ message: "Second" }) });
    assertEquals(document.querySelectorAll(".toast").length, 1);
    assertEquals(calls.length, 1);
  });

  it("should keep separate entries for different plugin ids using the same toast id", () => {
    clearDOM();
    const { renderer } = makePluginRenderer();
    const a = uniqueIds();
    const b = uniqueIds();
    const sharedToastId = 999_000 + nextPluginToastTestId++;
    showPluginToast({
      pluginRenderer: renderer,
      pluginId: a.pluginId,
      toastId: sharedToastId,
      element: noticeElNode({ message: "From A" }),
      timeout: 0,
    });
    showPluginToast({
      pluginRenderer: renderer,
      pluginId: b.pluginId,
      toastId: sharedToastId,
      element: noticeElNode({ message: "From B" }),
      timeout: 0,
    });
    assertEquals(document.querySelectorAll(".toast").length, 2);
  });
});

t.describe("hidePluginToast", (it) => {
  it("should dismiss the matching toast", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer } = makePluginRenderer(pluginId);
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode(),
      timeout: 0,
    });
    const toast = document.querySelector(".toast");
    assert(toast !== null);
    hidePluginToast({ pluginId, toastId });
    assert(!toast.classList.contains("active"));
  });

  it("should not throw when the toast does not exist", () => {
    clearDOM();
    hidePluginToast({ pluginId: "missing-never-shown", toastId: 999_999 });
  });

  it("should only dismiss the matching plugin's toast", () => {
    clearDOM();
    const { renderer } = makePluginRenderer();
    const a = uniqueIds();
    const b = uniqueIds();
    showPluginToast({
      pluginRenderer: renderer,
      pluginId: a.pluginId,
      toastId: a.toastId,
      element: noticeElNode({ message: "Message A" }),
      timeout: 0,
    });
    showPluginToast({
      pluginRenderer: renderer,
      pluginId: b.pluginId,
      toastId: b.toastId,
      element: noticeElNode({ message: "Message B" }),
      timeout: 0,
    });
    hidePluginToast({ pluginId: a.pluginId, toastId: a.toastId });
    const toasts = [...document.querySelectorAll(".toast")];
    const aToast = toasts.find((toast) =>
      toast.textContent.includes("Message A"),
    );
    const bToast = toasts.find((toast) =>
      toast.textContent.includes("Message B"),
    );
    assert(aToast !== undefined);
    assert(bToast !== undefined);
    assert(!aToast.classList.contains("active"));
  });

  it("should allow re-showing a toast with the same id after hide", () => {
    clearDOM();
    const { pluginId, toastId } = uniqueIds();
    const { renderer } = makePluginRenderer(pluginId);
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode({ message: "First" }),
      timeout: 0,
    });
    hidePluginToast({ pluginId, toastId });
    showPluginToast({
      pluginRenderer: renderer,
      pluginId,
      toastId,
      element: noticeElNode({ message: "Second" }),
      timeout: 0,
    });
    const second = [...document.querySelectorAll(".toast")].find((toast) =>
      toast.textContent.includes("Second"),
    );
    assert(second !== undefined);
  });
});

await t.run();
