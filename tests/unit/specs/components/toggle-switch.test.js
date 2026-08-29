import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/toggle-switch.js";

describe("toggle-switch", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function createToggle(attributes = {}) {
    const element = document.createElement("toggle-switch");
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    document.body.appendChild(element);
    return element;
  }

  describe("ToggleSwitch - rendering", () => {
    it("should render a track and knob with role switch on the element", () => {
      const element = createToggle();
      const track = element.querySelector(".toggle-switch-track");
      assert(track !== null);
      assert.deepEqual(element.getAttribute("role"), "switch");
      assert(track.querySelector(".toggle-switch-knob") !== null);
    });

    it("should render unchecked and enabled by default", () => {
      const element = createToggle();
      const track = element.querySelector(".toggle-switch-track");
      assert(!track.classList.contains("checked"));
      assert(!track.classList.contains("disabled"));
      assert.deepEqual(element.getAttribute("aria-checked"), "false");
      assert.deepEqual(element.getAttribute("aria-disabled"), "false");
      assert.deepEqual(element.getAttribute("tabindex"), "0");
      assert.deepEqual(element.checked, false);
      assert.deepEqual(element.disabled, false);
    });

    it("should render checked state from the checked attribute", () => {
      const element = createToggle({ checked: "" });
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("checked"));
      assert.deepEqual(element.getAttribute("aria-checked"), "true");
      assert.deepEqual(element.checked, true);
    });

    it("should render disabled state from the disabled attribute", () => {
      const element = createToggle({ disabled: "" });
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("disabled"));
      assert.deepEqual(element.getAttribute("aria-disabled"), "true");
      assert.deepEqual(element.getAttribute("tabindex"), "-1");
      assert.deepEqual(element.disabled, true);
    });

    it("should apply the label attribute as aria-label", () => {
      const element = createToggle({ label: "Dark mode" });
      assert.deepEqual(element.getAttribute("aria-label"), "Dark mode");
    });

    it("should default aria-label to empty string without a label attribute", () => {
      const element = createToggle();
      assert.deepEqual(element.getAttribute("aria-label"), "");
    });

    it("should not duplicate the track when connectedCallback runs again", () => {
      const element = createToggle();
      element.connectedCallback();
      assert.deepEqual(
        element.querySelectorAll(".toggle-switch-track").length,
        1,
      );
    });
  });

  describe("ToggleSwitch - attribute reactivity", () => {
    it("should update the DOM when the checked attribute is added", () => {
      const element = createToggle();
      element.setAttribute("checked", "");
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("checked"));
      assert.deepEqual(element.getAttribute("aria-checked"), "true");
    });

    it("should update the DOM when the checked attribute is removed", () => {
      const element = createToggle({ checked: "" });
      element.removeAttribute("checked");
      const track = element.querySelector(".toggle-switch-track");
      assert(!track.classList.contains("checked"));
      assert.deepEqual(element.getAttribute("aria-checked"), "false");
    });

    it("should update the DOM when the disabled attribute changes", () => {
      const element = createToggle();
      element.setAttribute("disabled", "");
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("disabled"));
      assert.deepEqual(element.getAttribute("tabindex"), "-1");

      element.removeAttribute("disabled");
      assert(!track.classList.contains("disabled"));
      assert.deepEqual(element.getAttribute("tabindex"), "0");
    });
  });

  describe("ToggleSwitch - property reflection", () => {
    it("should reflect the checked property to the attribute and DOM", () => {
      const element = createToggle();
      element.checked = true;
      assert(element.hasAttribute("checked"));
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("checked"));

      element.checked = false;
      assert(!element.hasAttribute("checked"));
      assert(!track.classList.contains("checked"));
    });

    it("should reflect the disabled property to the attribute and DOM", () => {
      const element = createToggle();
      element.disabled = true;
      assert(element.hasAttribute("disabled"));
      const track = element.querySelector(".toggle-switch-track");
      assert(track.classList.contains("disabled"));

      element.disabled = false;
      assert(!element.hasAttribute("disabled"));
      assert(!track.classList.contains("disabled"));
    });
  });

  describe("ToggleSwitch - click handling", () => {
    it("should dispatch a bubbling change event with the opposite checked value on click", () => {
      const element = createToggle();
      const changeListener = mock.fn();
      document.body.addEventListener("change", changeListener);
      element.querySelector(".toggle-switch-track").click();
      document.body.removeEventListener("change", changeListener);

      assert.deepEqual(changeListener.mock.callCount(), 1);
      assert.deepEqual(changeListener.mock.calls[0].arguments[0].detail, {
        checked: true,
      });
    });

    it("should dispatch change with checked false when already checked", () => {
      const element = createToggle({ checked: "" });
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      element.querySelector(".toggle-switch-track").click();

      assert.deepEqual(changeListener.mock.callCount(), 1);
      assert.deepEqual(changeListener.mock.calls[0].arguments[0].detail, {
        checked: false,
      });
    });

    it("should not change its own checked state on click", () => {
      const element = createToggle();
      element.querySelector(".toggle-switch-track").click();
      assert.deepEqual(element.checked, false);
      assert(!element.hasAttribute("checked"));
    });

    it("should not dispatch change when disabled", () => {
      const element = createToggle({ disabled: "" });
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      element.querySelector(".toggle-switch-track").click();
      assert.deepEqual(changeListener.mock.callCount(), 0);
    });
  });

  describe("ToggleSwitch - label association", () => {
    it("should dispatch a single change when a wrapping label is clicked", () => {
      const label = document.createElement("label");
      const labelText = document.createElement("span");
      labelText.textContent = "Dark mode";
      const element = document.createElement("toggle-switch");
      label.append(labelText, element);
      document.body.appendChild(label);

      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      labelText.click();

      assert.deepEqual(changeListener.mock.callCount(), 1);
      assert.deepEqual(changeListener.mock.calls[0].arguments[0].detail, {
        checked: true,
      });
    });

    it("should not double-fire when the switch inside a label is clicked directly", () => {
      const label = document.createElement("label");
      const element = document.createElement("toggle-switch");
      label.append(element);
      document.body.appendChild(label);

      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      element.querySelector(".toggle-switch-track").click();

      assert.deepEqual(changeListener.mock.callCount(), 1);
    });
  });

  describe("ToggleSwitch - keyboard handling", () => {
    function pressKey(track, key) {
      const event = new window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      track.dispatchEvent(event);
      return event;
    }

    it("should dispatch change on Enter", () => {
      const element = createToggle();
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      const event = pressKey(
        element.querySelector(".toggle-switch-track"),
        "Enter",
      );

      assert(event.defaultPrevented);
      assert.deepEqual(changeListener.mock.callCount(), 1);
      assert.deepEqual(changeListener.mock.calls[0].arguments[0].detail, {
        checked: true,
      });
    });

    it("should dispatch change on Space", () => {
      const element = createToggle({ checked: "" });
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      const event = pressKey(
        element.querySelector(".toggle-switch-track"),
        " ",
      );

      assert(event.defaultPrevented);
      assert.deepEqual(changeListener.mock.callCount(), 1);
      assert.deepEqual(changeListener.mock.calls[0].arguments[0].detail, {
        checked: false,
      });
    });

    it("should ignore other keys", () => {
      const element = createToggle();
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      const event = pressKey(
        element.querySelector(".toggle-switch-track"),
        "Escape",
      );

      assert(!event.defaultPrevented);
      assert.deepEqual(changeListener.mock.callCount(), 0);
    });

    it("should not dispatch change on Enter when disabled", () => {
      const element = createToggle({ disabled: "" });
      const changeListener = mock.fn();
      element.addEventListener("change", changeListener);
      const event = pressKey(
        element.querySelector(".toggle-switch-track"),
        "Enter",
      );

      assert(!event.defaultPrevented);
      assert.deepEqual(changeListener.mock.callCount(), 0);
    });
  });
});
