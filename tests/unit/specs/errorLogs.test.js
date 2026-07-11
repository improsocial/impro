import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { enableErrorLogs } from "/js/errorLogs.js";

const t = new TestSuite("ErrorLogs");

t.describe("enableErrorLogs", (it, { beforeEach, afterEach }) => {
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
    assertEquals(entries.length, 1);
    assertEquals(entries[0].dataset.logLevel, "error");
    assert(entries[0].textContent.includes("something broke"));
    assert(
      entries[0].querySelector("div").getAttribute("style").includes("255, 0"),
    );
    assertEquals(capturedError, ["something broke"]);
  });

  it("shows console.warn messages as warn entries with warn styling", () => {
    console.warn("heads up");

    const entries = getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].dataset.logLevel, "warn");
    assert(entries[0].textContent.includes("heads up"));
    assert(
      entries[0]
        .querySelector("div")
        .getAttribute("style")
        .includes("255, 200, 0"),
    );
    assertEquals(capturedWarn, ["heads up"]);
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
    assertEquals(errorLog.style.display, "none");

    console.warn("dismiss me");
    assertEquals(errorLog.style.display, "block");

    const entry = getEntries()[0];
    entry.querySelector("button").click();
    assertEquals(getEntries().length, 0);
  });
});

await t.run();
