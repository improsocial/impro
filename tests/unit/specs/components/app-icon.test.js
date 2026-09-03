import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/app-icon.js";

describe("app-icon", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a <use> reference into the sprite", () => {
    const element = document.createElement("app-icon");
    element.setAttribute("icon", "bell");
    document.body.appendChild(element);

    const use = element.querySelector("use");
    assert(use !== null);
    assert.deepEqual(use.getAttribute("href"), "#bell");
  });

  it("renders nothing when icon is absent", () => {
    const element = document.createElement("app-icon");
    document.body.appendChild(element);
    assert.deepEqual(element.innerHTML, "");
  });

  it("swaps the reference when the icon attribute changes", () => {
    const element = document.createElement("app-icon");
    element.setAttribute("icon", "bus");
    document.body.appendChild(element);
    assert.deepEqual(element.querySelector("use").getAttribute("href"), "#bus");

    element.setAttribute("icon", "car");
    assert.deepEqual(element.querySelector("use").getAttribute("href"), "#car");
  });
});
