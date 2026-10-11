import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/post-language-dialog.js";

describe("post-language-dialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  async function flushRender() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function createDialog({
    currentLanguages = ["en"],
    postLanguageHistory = [["en"], ["ja"]],
  } = {}) {
    const element = document.createElement("post-language-dialog");
    element.currentLanguages = currentLanguages;
    element.postLanguageHistory = postLanguageHistory;
    const events = { selected: [], closed: 0 };
    element.addEventListener("select-languages", (e) => {
      events.selected.push(e.detail.languages);
    });
    element.addEventListener("dialog-closed", () => {
      events.closed++;
    });
    document.body.appendChild(element);
    element.open();
    await flushRender();
    return { element, events };
  }

  function getOption(element, code) {
    return element.querySelector(
      `[data-testid="post-language-option-${code}"]`,
    );
  }

  function sectionCodes(element, section) {
    return [
      ...element.querySelectorAll(
        `[data-testid="post-language-section-${section}"] [data-testid^="post-language-option-"]`,
      ),
    ].map((row) => row.dataset.testid.replace("post-language-option-", ""));
  }

  async function toggle(element, code) {
    const input = getOption(element, code).querySelector("input");
    input.checked = !input.checked;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await flushRender();
  }

  async function search(element, query) {
    const input = element.querySelector(
      '[data-testid="post-language-search-input"]',
    );
    input.value = query;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await flushRender();
  }

  function clickDone(element) {
    element.querySelector('[data-testid="post-language-done-button"]').click();
  }

  it("checks the current languages on open", async () => {
    const { element } = await createDialog({ currentLanguages: ["ja", "en"] });
    assert.deepEqual(getOption(element, "ja").dataset.teststate, "checked");
    assert.deepEqual(getOption(element, "en").dataset.teststate, "checked");
    assert.deepEqual(getOption(element, "de").dataset.teststate, "unchecked");
  });

  it("splits combination history entries into recent languages", async () => {
    const { element } = await createDialog({
      currentLanguages: ["pt"],
      postLanguageHistory: [["en", "ja"], ["de"], ["pt"]],
    });
    assert.deepEqual(sectionCodes(element, "recent"), ["pt", "en", "ja", "de"]);
    assert(!sectionCodes(element, "all").includes("en"));
  });

  it("sorts the remaining languages by name", async () => {
    const { element } = await createDialog();
    const allCodes = sectionCodes(element, "all");
    // French sorts before German by name, but after it by code
    assert(allCodes.indexOf("fr") < allCodes.indexOf("de"));
  });

  it("dispatches the checked languages in selection order on Done", async () => {
    const { element, events } = await createDialog({
      currentLanguages: ["en"],
    });
    await toggle(element, "de");
    await toggle(element, "en");
    await toggle(element, "ja");
    clickDone(element);
    assert.deepEqual(events.selected, [["de", "ja"]]);
  });

  it("disables unchecked languages once three are checked", async () => {
    const { element } = await createDialog({ currentLanguages: ["en"] });
    await toggle(element, "ja");
    await toggle(element, "de");
    assert(getOption(element, "fr").querySelector("input").disabled);
    assert(!getOption(element, "de").querySelector("input").disabled);
    await toggle(element, "de");
    assert(!getOption(element, "fr").querySelector("input").disabled);
  });

  it("does not dispatch a selection when closed without Done", async () => {
    const { element, events } = await createDialog();
    await toggle(element, "de");
    element
      .querySelector(".post-language-dialog")
      .dispatchEvent(new window.Event("cancel", { cancelable: true }));
    await element.close();
    assert.deepEqual(events.selected, []);
  });

  it("filters by name, ignoring case and accents, and keeps checked rows", async () => {
    const { element } = await createDialog({ currentLanguages: ["en"] });
    await search(element, "  GERMAN ");
    assert.deepEqual(sectionCodes(element, "recent"), ["en"]);
    assert.deepEqual(sectionCodes(element, "all"), ["de"]);
    await search(element, "frénch");
    assert.deepEqual(sectionCodes(element, "all"), ["fr"]);
  });

  it("matches a language code exactly", async () => {
    const { element } = await createDialog({ currentLanguages: ["en"] });
    await search(element, "de");
    assert(sectionCodes(element, "all").includes("de"));
  });

  it("shows an empty state when nothing unchecked matches", async () => {
    const { element } = await createDialog();
    await search(element, "zzzz");
    assert(element.querySelector('[data-testid="empty-state"]'));
    await search(element, "");
    assert.deepEqual(
      element.querySelector('[data-testid="empty-state"]'),
      null,
    );
  });
});
