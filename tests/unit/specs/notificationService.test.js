import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { NotificationService } from "/js/notificationService.js";

// Mock API
function createMockApi({ numNotifications = 0, markAsReadFn = null } = {}) {
  return {
    getNumNotifications: async () => numNotifications,
    markNotificationsAsRead: markAsReadFn || (async () => {}),
  };
}

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

    // Start marking as read (don't await)
    const markPromise = service.markNotificationsAsRead();

    // Count should immediately be zero
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
