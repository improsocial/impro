import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const swSource = readFileSync(new URL("../../../src/sw.js", import.meta.url), {
  encoding: "utf8",
});

const ORIGIN = "https://impro.example";

function createWindowClient(url) {
  return {
    url,
    focused: false,
    postMessage: mock.fn(),
    focus: mock.fn(async () => {}),
    navigate: mock.fn(async () => {}),
  };
}

function loadServiceWorker({ clients }) {
  const listeners = new Map();
  const fakeSelf = {
    location: new URL(ORIGIN),
    navigator: {},
    registration: { showNotification: mock.fn(async () => {}) },
    clients: {
      matchAll: mock.fn(async () => clients),
      openWindow: mock.fn(async () => {}),
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  new Function("self", swSource)(fakeSelf);
  return { self: fakeSelf, listeners };
}

async function clickNotification(listeners, data) {
  let pending = null;
  const event = {
    notification: { data, close: mock.fn() },
    waitUntil(promise) {
      pending = promise;
    },
  };
  listeners.get("notificationclick")(event);
  await pending;
  return event;
}

describe("service worker notificationclick", () => {
  let client;

  beforeEach(() => {
    client = createWindowClient(`${ORIGIN}/`);
  });

  it("messages and focuses an open window instead of navigating it", async () => {
    const { listeners, self } = loadServiceWorker({ clients: [client] });

    const event = await clickNotification(listeners, {
      url: "/notifications?tab=mentions",
    });

    assert.equal(event.notification.close.mock.callCount(), 1);
    assert.deepEqual(client.postMessage.mock.calls[0].arguments, [
      { type: "notification-click", url: "/notifications?tab=mentions" },
    ]);
    assert.equal(client.focus.mock.callCount(), 1);
    assert.equal(client.navigate.mock.callCount(), 0);
    assert.equal(self.clients.openWindow.mock.callCount(), 0);
  });

  it("opens a new window when no same-origin window is open", async () => {
    const otherOrigin = createWindowClient("https://other.example/");
    const { listeners, self } = loadServiceWorker({ clients: [otherOrigin] });

    await clickNotification(listeners, { url: "/notifications" });

    assert.equal(otherOrigin.postMessage.mock.callCount(), 0);
    assert.deepEqual(self.clients.openWindow.mock.calls[0].arguments, [
      `${ORIGIN}/notifications`,
    ]);
  });
});
