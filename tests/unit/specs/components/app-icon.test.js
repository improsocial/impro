import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/app-icon.js";
import usedIcons from "/js/iconData.js";
import allIcons from "/js/iconDataAll.js";

const unusedIcon = Object.keys(allIcons).find((id) => !usedIcons[id]);

function renderIcon(icon) {
  const element = document.createElement("app-icon");
  if (icon) element.setAttribute("icon", icon);
  document.body.appendChild(element);
  return element;
}

const spriteSymbols = (id) => document.querySelectorAll(`svg symbol#${id}`);

const flushFullIconLoad = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("app-icon", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a <use> reference to a sprite symbol for icons the app uses", () => {
    assert(usedIcons.bell);
    const element = renderIcon("bell");

    assert.equal(element.querySelector("use").getAttribute("href"), "#bell");
    assert.equal(spriteSymbols("bell").length, 1);
  });

  it("adds each symbol to the sprite once", () => {
    renderIcon("bell");
    renderIcon("bell");
    assert.equal(spriteSymbols("bell").length, 1);
  });

  it("re-attaches the sprite if it was removed from the document", () => {
    renderIcon("bell");
    document.body.innerHTML = "";
    renderIcon("bell");
    assert.equal(spriteSymbols("bell").length, 1);
  });

  it("loads icons the app doesn't use from the full icon set", async () => {
    assert(unusedIcon);
    const element = renderIcon(unusedIcon);
    assert.equal(element.querySelector("use"), null);

    await flushFullIconLoad();

    assert.equal(
      element.querySelector("use").getAttribute("href"),
      `#${unusedIcon}`,
    );
    assert.equal(spriteSymbols(unusedIcon).length, 1);
  });

  it("renders an empty svg for icons that don't exist", async () => {
    const element = renderIcon("not-a-real-icon");
    await flushFullIconLoad();
    assert(element.querySelector("svg"));
    assert.equal(element.querySelector("use"), null);
  });

  it("renders nothing when icon is absent", () => {
    const element = renderIcon(null);
    assert.equal(element.innerHTML, "");
  });

  it("swaps the reference when the icon attribute changes", () => {
    const element = renderIcon("bell");
    element.setAttribute("icon", "bell-line");
    assert.equal(
      element.querySelector("use").getAttribute("href"),
      "#bell-line",
    );
  });
});
