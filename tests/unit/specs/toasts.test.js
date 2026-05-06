import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { showToast } from "/js/toasts.js";
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

await t.run();
