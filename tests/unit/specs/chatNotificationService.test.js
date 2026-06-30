import { TestSuite } from "../testSuite.js";
import { assertEquals } from "../testHelpers.js";
import { ChatNotificationService } from "/js/chatNotificationService.js";

const t = new TestSuite("chatNotificationService");

function createMockApi({
  unreadAcceptedConvos = 0,
  unreadRequestConvos = 0,
} = {}) {
  return {
    getChatUnreadCounts: async () => ({
      unreadAcceptedConvos,
      unreadRequestConvos,
    }),
  };
}

t.describe("constructor", (it) => {
  it("should initialize with zero notifications", () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);
    assertEquals(service.$numNotifications.get(), 0);
  });
});

t.describe("fetchNumNotifications", (it) => {
  it("should update notification count from API", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 3);
  });

  it("should sum accepted and request convo counts", async () => {
    const api = createMockApi({
      unreadAcceptedConvos: 2,
      unreadRequestConvos: 3,
    });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 5);
  });

  it("should update $numNotifications signal when count changes", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 1 });
    const service = new ChatNotificationService(api);

    assertEquals(service.$numNotifications.get(), 0);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 1);
  });

  it("should handle zero counts", async () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 0);
  });
});

t.describe("markNotificationsAsReadForConvo", (it) => {
  it("should optimistically decrement the count", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("2");
    assertEquals(service.$numNotifications.get(), 2);
  });

  it("should not decrement when the count is already 0", async () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 0);

    service.markNotificationsAsReadForConvo("any");
    assertEquals(service.$numNotifications.get(), 0);
  });

  it("should not decrement twice for the same convo id", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assertEquals(service.$numNotifications.get(), 2);
    service.markNotificationsAsReadForConvo("a");
    assertEquals(service.$numNotifications.get(), 2);
  });

  it("should not bounce when the server hasn't yet acked the read", async () => {
    let unreadAcceptedConvos = 3;
    const api = {
      getChatUnreadCounts: async () => ({
        unreadAcceptedConvos,
        unreadRequestConvos: 0,
      }),
    };
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assertEquals(service.$numNotifications.get(), 2);

    // Server hasn't caught up yet — still reports 3. Badge should stay at 2.
    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 2);

    // Server catches up.
    unreadAcceptedConvos = 2;
    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 2);
  });

  it("should decrement again after a refetch clears the dedup set", async () => {
    let unreadAcceptedConvos = 3;
    const api = {
      getChatUnreadCounts: async () => ({
        unreadAcceptedConvos,
        unreadRequestConvos: 0,
      }),
    };
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assertEquals(service.$numNotifications.get(), 2);

    // Next poll: server caught up.
    unreadAcceptedConvos = 2;
    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 2);

    // Server later re-flags convo "a" (e.g. new message) — count goes back up.
    unreadAcceptedConvos = 3;
    await service.fetchNumNotifications();
    assertEquals(service.$numNotifications.get(), 3);

    // Reading "a" again should decrement, since the dedup set was cleared.
    service.markNotificationsAsReadForConvo("a");
    assertEquals(service.$numNotifications.get(), 2);
  });
});

await t.run();
