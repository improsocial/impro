import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  enableErrorLogs,
  logAuthEvent,
  readAuthDebugLog,
} from "/js/errorLogs.js";

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

describe("auth debug log", () => {
  beforeEach(() => {
    localStorage.clear();
    mock.method(console, "info", () => {});
  });

  afterEach(() => {
    localStorage.clear();
    mock.restoreAll();
  });

  it("does nothing when the flag is not set", () => {
    logAuthEvent("logout", { did: "did:plc:alice" });
    assert.deepEqual(readAuthDebugLog(), []);
  });

  it("persists entries when the flag is set", () => {
    localStorage.setItem("debug-auth", "true");
    logAuthEvent("logout", { did: "did:plc:alice" });
    logAuthEvent("boot", { did: null });
    const entries = readAuthDebugLog();
    assert.deepEqual(
      entries.map((entry) => [entry.event, entry.did]),
      [
        ["logout", "did:plc:alice"],
        ["boot", null],
      ],
    );
    assert(entries[0].time);
  });

  it("tags entries with a stable per-tab id", () => {
    localStorage.setItem("debug-auth", "true");
    logAuthEvent("boot", { did: null });
    logAuthEvent("logout", { did: null });
    const [first, second] = readAuthDebugLog();
    assert(first.tab);
    assert.equal(first.tab, second.tab);
  });

  it("caps the number of stored entries", () => {
    localStorage.setItem("debug-auth", "true");
    for (let i = 0; i < 205; i++) {
      logAuthEvent("event", { index: i });
    }
    const entries = readAuthDebugLog();
    assert.equal(entries.length, 200);
    assert.equal(entries[0].index, 5);
  });
});
