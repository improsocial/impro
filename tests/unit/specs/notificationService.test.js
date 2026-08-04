import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../testHelpers.js";
import { NotificationService } from "/js/notificationService.js";

function createMockApi({
  numNotifications = 0,
  markAsReadFn = null,
  getNotificationsFn = null,
  topUri = "at://did:example/app.bsky.feed.post/first",
} = {}) {
  return {
    getNumNotifications: async () => numNotifications,
    markNotificationsAsRead: markAsReadFn || (async () => {}),
    getNotifications:
      getNotificationsFn ||
      (async () => ({ notifications: topUri ? [{ uri: topUri }] : [] })),
  };
}

describe("NotificationService", () => {
  const originalSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });
  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  describe("constructor", () => {
    it("should initialize with zero notifications", () => {
      const api = createMockApi();
      const service = new NotificationService(api);
      assert.deepEqual(service.$numNotifications.get(), 0);
    });
  });

  describe("fetchNumNotifications", () => {
    it("should update notification count from API", async () => {
      const api = createMockApi({ numNotifications: 5 });
      const service = new NotificationService(api);

      await service.fetchNumNotifications();

      assert.deepEqual(service.$numNotifications.get(), 5);
    });

    it("should update $numNotifications signal when count changes", async () => {
      const api = createMockApi({ numNotifications: 3 });
      const service = new NotificationService(api);

      assert.deepEqual(service.$numNotifications.get(), 0);

      await service.fetchNumNotifications();

      assert.deepEqual(service.$numNotifications.get(), 3);
    });

    it("commits the increased count once the list reflects a new top item", async () => {
      let topUri = "at://did:example/app.bsky.feed.post/first";
      const getNotificationsFn = mock.fn(async () => ({
        notifications: [{ uri: topUri }],
      }));
      const api = createMockApi({
        numNotifications: 1,
        getNotificationsFn,
      });
      const service = new NotificationService(api);

      // First tick: 0 -> 1, list returns "first" (baseline), commits.
      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 1);

      // Server bumps count but list is still stale.
      api.getNumNotifications = async () => 2;
      await service.fetchNumNotifications();
      assert.deepEqual(
        service.$numNotifications.get(),
        1,
        "count should stay 1 while list is stale",
      );

      // Now the list catches up.
      topUri = "at://did:example/app.bsky.feed.post/second";
      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 2);
    });

    it("retries the list probe when the top URI hasn't changed yet", async () => {
      let topUri = "at://did:example/app.bsky.feed.post/first";
      const getNotificationsFn = mock.fn(async () => ({
        notifications: [{ uri: topUri }],
      }));
      const api = createMockApi({
        numNotifications: 1,
        getNotificationsFn,
      });
      const service = new NotificationService(api);

      // Establish baseline.
      await service.fetchNumNotifications();
      assert.deepEqual(getNotificationsFn.mock.callCount(), 1);

      // Count bumps; make the list return the fresh URI only on the 3rd probe.
      api.getNumNotifications = async () => 2;
      let probe = 0;
      api.getNotifications = async () => {
        probe++;
        return {
          notifications: [
            {
              uri:
                probe < 3
                  ? topUri
                  : "at://did:example/app.bsky.feed.post/second",
            },
          ],
        };
      };

      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 2);
      assert.deepEqual(probe, 3);
    });

    it("gives up after the max retries and keeps the old count", async () => {
      const api = createMockApi({
        numNotifications: 1,
        topUri: "at://did:example/app.bsky.feed.post/first",
      });
      const service = new NotificationService(api);
      await service.fetchNumNotifications();

      api.getNumNotifications = async () => 5;
      // Top URI never changes.
      const probe = mock.fn(async () => ({
        notifications: [{ uri: "at://did:example/app.bsky.feed.post/first" }],
      }));
      api.getNotifications = probe;

      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 1);
      assert.deepEqual(probe.mock.callCount(), 3);
    });

    it("commits decreases immediately without probing the list", async () => {
      const api = createMockApi({
        numNotifications: 5,
        topUri: "at://did:example/app.bsky.feed.post/first",
      });
      const service = new NotificationService(api);
      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 5);

      api.getNumNotifications = async () => 2;
      const probe = mock.fn(async () => ({ notifications: [] }));
      api.getNotifications = probe;

      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 2);
      assert.deepEqual(probe.mock.callCount(), 0);
    });

    it("keeps the old count when the probe throws", async () => {
      const api = createMockApi({
        numNotifications: 1,
        topUri: "at://did:example/app.bsky.feed.post/first",
      });
      const service = new NotificationService(api);
      await service.fetchNumNotifications();

      api.getNumNotifications = async () => 2;
      api.getNotifications = async () => {
        throw new Error("appview down");
      };

      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 1);
    });
  });

  describe("startPolling", () => {
    it("keeps polling after a poll throws", async (t) => {
      t.mock.method(console, "error", () => {});
      const api = createMockApi();
      let calls = 0;
      api.getNumNotifications = async () => {
        calls++;
        if (calls === 1) {
          throw new Error("network blip");
        }
        return 3;
      };
      const service = new NotificationService(api);

      const stopPolling = service.startPolling();
      t.after(stopPolling);

      await waitFor(() => service.$numNotifications.get() === 3);
    });
  });

  describe("$numNotifications", () => {
    it("should reflect current notification count", async () => {
      const api = createMockApi({ numNotifications: 7 });
      const service = new NotificationService(api);

      assert.deepEqual(service.$numNotifications.get(), 0);

      await service.fetchNumNotifications();

      assert.deepEqual(service.$numNotifications.get(), 7);
    });
  });

  describe("markNotificationsAsRead", () => {
    it("should optimistically set count to zero", async () => {
      const api = createMockApi({ numNotifications: 5 });
      const service = new NotificationService(api);

      await service.fetchNumNotifications();
      assert.deepEqual(service.$numNotifications.get(), 5);

      const markPromise = service.markNotificationsAsRead();

      assert.deepEqual(service.$numNotifications.get(), 0);

      await markPromise;
    });

    it("should call api.markNotificationsAsRead", async () => {
      const markAsReadFn = mock.fn();
      const api = createMockApi({
        numNotifications: 5,
        markAsReadFn,
      });
      const service = new NotificationService(api);

      await service.markNotificationsAsRead();

      assert.deepEqual(markAsReadFn.mock.callCount(), 1);
    });
  });
});
