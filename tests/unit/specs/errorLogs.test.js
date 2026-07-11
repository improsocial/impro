import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enableErrorLogs } from "/js/errorLogs.js";

describe("enableErrorLogs", () => {
  let originalError;
  let originalWarn;
  let capturedError;
  let capturedWarn;

  beforeEach(() => {
    originalError = console.error;
    originalWarn = console.warn;
    capturedError = null;
    capturedWarn = null;
    console.error = (...args) => {
      capturedError = args;
    };
    console.warn = (...args) => {
      capturedWarn = args;
    };
    enableErrorLogs();
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
    document.getElementById("error-log")?.remove();
    delete window.logMessage;
  });

  function getEntries() {
    return [...document.querySelectorAll("#error-log [data-log-level]")];
  }

  it("shows console.error messages as error entries", () => {
    console.error("something broke");

    const entries = getEntries();
    assert.deepEqual(entries.length, 1);
    assert.deepEqual(entries[0].dataset.logLevel, "error");
    assert(entries[0].textContent.includes("something broke"));
    assert(
      entries[0].querySelector("div").getAttribute("style").includes("255, 0"),
    );
    assert.deepEqual(capturedError, ["something broke"]);
  });

  it("shows console.warn messages as warn entries with warn styling", () => {
    console.warn("heads up");

    const entries = getEntries();
    assert.deepEqual(entries.length, 1);
    assert.deepEqual(entries[0].dataset.logLevel, "warn");
    assert(entries[0].textContent.includes("heads up"));
    assert(
      entries[0]
        .querySelector("div")
        .getAttribute("style")
        .includes("255, 200, 0"),
    );
    assert.deepEqual(capturedWarn, ["heads up"]);
  });

  it("stringifies object arguments", () => {
    console.warn("[feed-debug]", { reload: true, fromTop: true });

    const entries = getEntries();
    assert(
      entries[0].textContent.includes('{"reload":true,"fromTop":true}'),
      `unexpected entry text: ${entries[0].textContent}`,
    );
  });

  it("makes the log visible on first message and supports dismissing entries", () => {
    const errorLog = document.getElementById("error-log");
    assert.deepEqual(errorLog.style.display, "none");

    console.warn("dismiss me");
    assert.deepEqual(errorLog.style.display, "block");

    const entry = getEntries()[0];
    entry.querySelector("button").click();
    assert.deepEqual(getEntries().length, 0);
  });
});
