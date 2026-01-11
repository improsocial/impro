import { TestSuite } from "./testSuite.js";
import { assert, assertEquals, mock } from "./testHelpers.js";
import { NotificationService } from "../src/js/notificationService.js";

const t = new TestSuite("notificationService");

// Mock API
function createMockApi({ numNotifications = 0, markAsReadFn = null } = {}) {
  return {
    getNumNotifications: async () => numNotifications,
    markNotificationsAsRead: markAsReadFn || (async () => {}),
  };
}

t.describe("constructor", (it) => {
  it("should initialize with zero notifications", () => {
    const api = createMockApi();
    const service = new NotificationService(api);
    assertEquals(service.getNumNotifications(), 0);
  });
});

t.describe("fetchNumNotifications", (it) => {
  it("should update notification count from API", async () => {
    const api = createMockApi({ numNotifications: 5 });
    const service = new NotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.getNumNotifications(), 5);
  });

  it("should emit update event when count changes", async () => {
    const api = createMockApi({ numNotifications: 3 });
    const service = new NotificationService(api);

    const updateHandler = mock();
    service.on("update", updateHandler);

    await service.fetchNumNotifications();

    assertEquals(updateHandler.calls.length, 1);
  });

  it("should not emit update event when count is unchanged", async () => {
    const api = createMockApi({ numNotifications: 3 });
    const service = new NotificationService(api);

    // First fetch
    await service.fetchNumNotifications();

    const updateHandler = mock();
    service.on("update", updateHandler);

    // Second fetch with same count
    await service.fetchNumNotifications();

    assertEquals(updateHandler.calls.length, 0);
  });
});

t.describe("getNumNotifications", (it) => {
  it("should return current notification count", async () => {
    const api = createMockApi({ numNotifications: 7 });
    const service = new NotificationService(api);

    assertEquals(service.getNumNotifications(), 0);

    await service.fetchNumNotifications();

    assertEquals(service.getNumNotifications(), 7);
  });
});

t.describe("markNotificationsAsRead", (it) => {
  it("should optimistically set count to zero", async () => {
    const api = createMockApi({ numNotifications: 5 });
    const service = new NotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.getNumNotifications(), 5);

    // Start marking as read (don't await)
    const markPromise = service.markNotificationsAsRead();

    // Count should immediately be zero
    assertEquals(service.getNumNotifications(), 0);

    await markPromise;
  });

  it("should emit update event", async () => {
    const api = createMockApi({ numNotifications: 5 });
    const service = new NotificationService(api);

    await service.fetchNumNotifications();

    const updateHandler = mock();
    service.on("update", updateHandler);

    await service.markNotificationsAsRead();

    assertEquals(updateHandler.calls.length, 1);
  });

  it("should call api.markNotificationsAsRead", async () => {
    const markAsReadFn = mock();
    const api = createMockApi({
      numNotifications: 5,
      markAsReadFn,
    });
    const service = new NotificationService(api);

    await service.markNotificationsAsRead();

    assertEquals(markAsReadFn.calls.length, 1);
  });
});

await t.run();
