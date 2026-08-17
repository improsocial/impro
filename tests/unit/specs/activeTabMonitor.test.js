import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startActiveTabMonitor } from "/js/activeTabMonitor.js";
import { installFakeBroadcastChannel } from "../testHelpers.js";

const CHANNEL_NAME = "active-tab-monitor";

function macrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// One delivery hop each way, plus room for the reply to be handled.
async function flushChannel() {
  await macrotask();
  await macrotask();
  await macrotask();
}

describe("startActiveTabMonitor", () => {
  let monitors;
  let peers;
  let restoreBroadcastChannel;
  let originalHasFocus;

  function simulateTabState({ visible, focused }) {
    Object.defineProperty(document, "visibilityState", {
      value: visible ? "visible" : "hidden",
      configurable: true,
    });
    document.hasFocus = () => focused;
  }

  function startMonitor({ replyTimeoutMs = 100 } = {}) {
    const monitor = startActiveTabMonitor({ replyTimeoutMs });
    monitors.push(monitor);
    return monitor;
  }

  // Stands in for another tab, so the monitor under test is the only thing
  // reading this document's focus state.
  function createPeer({ answersQueries = false, id = null } = {}) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const received = [];
    channel.addEventListener("message", (event) => {
      received.push(event.data);
      if (answersQueries && event.data?.method === "isTabActive") {
        channel.postMessage({ id: id ?? event.data.id, result: true });
      }
    });
    peers.push(channel);
    return { channel, received };
  }

  beforeEach(() => {
    monitors = [];
    peers = [];
    restoreBroadcastChannel = installFakeBroadcastChannel();
    originalHasFocus = document.hasFocus;
    simulateTabState({ visible: true, focused: false });
  });

  afterEach(() => {
    for (const monitor of monitors) {
      monitor.stop();
    }
    for (const peer of peers) {
      peer.close();
    }
    restoreBroadcastChannel();
    document.hasFocus = originalHasFocus;
    delete document.visibilityState;
  });

  describe("this tab's own focus", () => {
    it("is active when visible and focused", async () => {
      const monitor = startMonitor();
      simulateTabState({ visible: true, focused: true });

      assert.deepEqual(await monitor.isAnyTabActive(), true);
    });

    it("is not active when focused but hidden", async () => {
      const monitor = startMonitor();
      simulateTabState({ visible: false, focused: true });

      assert.deepEqual(await monitor.isAnyTabActive(), false);
    });

    it("is not active when visible but unfocused", async () => {
      const monitor = startMonitor();
      simulateTabState({ visible: true, focused: false });

      assert.deepEqual(await monitor.isAnyTabActive(), false);
    });
  });

  describe("answering other tabs", () => {
    it("answers a focus query while focused", async () => {
      startMonitor();
      const peer = createPeer();
      simulateTabState({ visible: true, focused: true });

      peer.channel.postMessage({ method: "isTabActive", id: "req-1" });
      await flushChannel();

      assert.deepEqual(peer.received, [{ id: "req-1", result: true }]);
    });

    it("stays silent on a focus query while unfocused", async () => {
      startMonitor();
      const peer = createPeer();

      peer.channel.postMessage({ method: "isTabActive", id: "req-1" });
      await flushChannel();

      assert.deepEqual(peer.received, []);
    });

    it("stops answering once stopped", async () => {
      const monitor = startMonitor();
      const peer = createPeer();
      simulateTabState({ visible: true, focused: true });

      monitor.stop();
      peer.channel.postMessage({ method: "isTabActive", id: "req-1" });
      await flushChannel();

      assert.deepEqual(peer.received, []);
    });
  });

  describe("asking other tabs", () => {
    it("is active when a peer answers", async () => {
      createPeer({ answersQueries: true });
      const monitor = startMonitor();

      assert.deepEqual(await monitor.isAnyTabActive(), true);
    });

    it("ignores a response carrying another request's id", async () => {
      createPeer({ answersQueries: true, id: "someone-else" });
      const monitor = startMonitor();

      assert.deepEqual(await monitor.isAnyTabActive(), false);
    });

    it("is inactive when a peer stays silent", async () => {
      createPeer();
      const monitor = startMonitor();

      assert.deepEqual(await monitor.isAnyTabActive(), false);
    });

    it("is inactive when no other tab is open", async () => {
      const monitor = startMonitor();

      assert.deepEqual(await monitor.isAnyTabActive(), false);
    });

    it("does not ask when this tab is already active", async () => {
      const peer = createPeer({ answersQueries: true });
      const monitor = startMonitor();
      simulateTabState({ visible: true, focused: true });

      assert.deepEqual(await monitor.isAnyTabActive(), true);
      await flushChannel();

      assert.deepEqual(peer.received, []);
    });

    it("is inactive without BroadcastChannel support", async (t) => {
      const warn = t.mock.method(console, "warn", () => {});
      restoreBroadcastChannel();
      const originalChannel = globalThis.BroadcastChannel;
      delete globalThis.BroadcastChannel;
      try {
        const monitor = startActiveTabMonitor();
        assert.deepEqual(await monitor.isAnyTabActive(), false);
        assert.deepEqual(warn.mock.callCount(), 1);
      } finally {
        globalThis.BroadcastChannel = originalChannel;
        restoreBroadcastChannel = installFakeBroadcastChannel();
      }
    });
  });
});
