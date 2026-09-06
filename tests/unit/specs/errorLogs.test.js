import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enableErrorLogs } from "/js/errorLogs.js";

describe("errorLogs overlay", () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  let overlay;

  function entries() {
    return [...overlay.querySelectorAll("[data-log-level]")];
  }

  beforeEach(() => {
    console.warn = () => {};
    console.error = () => {};
    enableErrorLogs();
    overlay = document.getElementById("error-log");
  });

  afterEach(() => {
    overlay.remove();
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("shows warnings in the overlay", () => {
    console.warn("[plugins] something odd");
    assert.deepEqual(entries().length, 1);
    assert(entries()[0].textContent.includes("[plugins] something odd"));
    assert.deepEqual(overlay.style.display, "block");
  });

  it("suppresses warnings carrying an advisory tag", () => {
    console.warn('[plugins:perf] "some-plugin" slot "x" ran 100 times');
    assert.deepEqual(entries(), []);
    assert.deepEqual(overlay.style.display, "none");
  });

  it("shows hints tagged for local dev plugins", () => {
    console.warn(
      '[plugins:perf:local] "my-plugin__LOCAL" slot "x" ran 100 times',
    );
    assert.deepEqual(entries().length, 1);
  });

  it("only matches the tag at the start of the message", () => {
    console.warn("prefix [plugins:perf] not a hint");
    assert.deepEqual(entries().length, 1);
  });

  it("still shows errors", () => {
    console.error("[plugins:perf] errors are never suppressed");
    assert.deepEqual(entries().length, 1);
    assert.deepEqual(entries()[0].dataset.logLevel, "error");
  });
});
