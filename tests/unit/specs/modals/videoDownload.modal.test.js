import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { VideoDownloadModal } from "/js/modals/videoDownload.modal.js";
import { flushMicrotasks } from "../../testHelpers.js";

describe("VideoDownloadModal", () => {
  let resolveFile;
  let rejectFile;
  let loadFile;
  let share;

  beforeEach(() => {
    document.body.innerHTML = "";
    loadFile = mock.fn(
      () =>
        new Promise((resolve, reject) => {
          resolveFile = resolve;
          rejectFile = reject;
        }),
    );
    share = mock.fn(async () => {});
    Object.defineProperty(window.navigator, "share", {
      value: share,
      configurable: true,
    });
    Object.defineProperty(window.navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete window.navigator.share;
    delete window.navigator.canShare;
  });

  function getContent() {
    return document.querySelector(
      '[data-testid="video-download-modal"] .modal-dialog-content',
    );
  }

  function getSaveButton() {
    return document.querySelector('[data-testid="video-download-save-button"]');
  }

  it("opens in the preparing state with Save disabled", () => {
    VideoDownloadModal.open({ loadFile });
    assert.deepEqual(getContent().dataset.teststate, "preparing");
    assert(getSaveButton().disabled);
    assert.deepEqual(loadFile.mock.callCount(), 1);
  });

  it("enables Save once the file has loaded", async () => {
    VideoDownloadModal.open({ loadFile });
    resolveFile(new File(["video"], "alice-abc.mp4", { type: "video/mp4" }));
    await flushMicrotasks();
    assert.deepEqual(getContent().dataset.teststate, "ready");
    assert(!getSaveButton().disabled);
  });

  it("opens the share sheet synchronously when Save is clicked, then closes", async () => {
    const result = VideoDownloadModal.open({ loadFile });
    const file = new File(["video"], "alice-abc.mp4", { type: "video/mp4" });
    resolveFile(file);
    await flushMicrotasks();
    getSaveButton().click();
    assert.deepEqual(share.mock.callCount(), 1);
    assert.deepEqual(share.mock.calls[0].arguments, [{ files: [file] }]);
    await result;
    assert(
      document.querySelector('[data-testid="video-download-modal"]') === null,
    );
  });

  it("downloads the file from the Save tap when it can't be shared", async (t) => {
    Object.defineProperty(window.navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:video";
    URL.revokeObjectURL = () => {};
    t.after(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const clickedDownloads = [];
    t.mock.method(window.HTMLAnchorElement.prototype, "click", function () {
      clickedDownloads.push(this.download);
    });
    const result = VideoDownloadModal.open({ loadFile });
    resolveFile(new File(["video"], "alice-abc.mp4", { type: "video/mp4" }));
    await flushMicrotasks();
    getSaveButton().click();
    assert.deepEqual(clickedDownloads, ["alice-abc.mp4"]);
    assert.deepEqual(share.mock.callCount(), 0);
    await result;
  });

  it("still closes when the share sheet is dismissed", async () => {
    share.mock.mockImplementation(async () => {
      throw new DOMException("Share canceled", "AbortError");
    });
    const result = VideoDownloadModal.open({ loadFile });
    resolveFile(new File(["video"], "alice-abc.mp4", { type: "video/mp4" }));
    await flushMicrotasks();
    getSaveButton().click();
    await result;
    assert(
      document.querySelector('[data-testid="video-download-modal"]') === null,
    );
  });

  it("shows the error state when the file fails to load", async (t) => {
    t.mock.method(console, "warn", () => {});
    VideoDownloadModal.open({ loadFile });
    rejectFile(new Error("HTTP 400"));
    await flushMicrotasks();
    assert.deepEqual(getContent().dataset.teststate, "error");
    assert(getSaveButton() === null);
    assert(
      document.querySelector('[data-testid="video-download-close-button"]') !==
        null,
    );
  });

  it("aborts the download when cancelled while preparing", async () => {
    const result = VideoDownloadModal.open({ loadFile });
    const signal = loadFile.mock.calls[0].arguments[0];
    document.querySelector('[data-testid="modal-cancel-button"]').click();
    await result;
    assert(signal.aborted);
  });
});
