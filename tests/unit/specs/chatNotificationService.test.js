import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChatNotificationService } from "/js/chatNotificationService.js";

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

describe("constructor", () => {
  it("should initialize with zero notifications", () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);
    assert.deepEqual(service.$numNotifications.get(), 0);
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 0);
  });
});

describe("fetchNumNotifications", () => {
  it("should update notification count from API", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assert.deepEqual(service.$numNotifications.get(), 3);
  });

  it("should sum accepted and request convo counts", async () => {
    const api = createMockApi({
      unreadAcceptedConvos: 2,
      unreadRequestConvos: 3,
    });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assert.deepEqual(service.$numNotifications.get(), 5);
  });

  it("should update $numNotifications signal when count changes", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 1 });
    const service = new ChatNotificationService(api);

    assert.deepEqual(service.$numNotifications.get(), 0);

    await service.fetchNumNotifications();

    assert.deepEqual(service.$numNotifications.get(), 1);
  });

  it("should handle zero counts", async () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assert.deepEqual(service.$numNotifications.get(), 0);
  });

  it("should publish the unread request count from the server", async () => {
    const api = createMockApi({
      unreadAcceptedConvos: 2,
      unreadRequestConvos: 3,
    });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assert.deepEqual(service.$numUnreadRequestConvos.get(), 3);
  });

  it("should overwrite the unread request count on each poll", async () => {
    let unreadRequestConvos = 3;
    const api = {
      getChatUnreadCounts: async () => ({
        unreadAcceptedConvos: 0,
        unreadRequestConvos,
      }),
    };
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 3);

    unreadRequestConvos = 1;
    await service.fetchNumNotifications();
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 1);
  });
});

describe("markNotificationsAsReadForConvo", () => {
  it("should optimistically decrement the count", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("2");
    assert.deepEqual(service.$numNotifications.get(), 2);
  });

  it("should not decrement when the count is already 0", async () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 0);

    service.markNotificationsAsReadForConvo("any");
    assert.deepEqual(service.$numNotifications.get(), 0);
  });

  it("should not decrement twice for the same convo id", async () => {
    const api = createMockApi({ unreadAcceptedConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numNotifications.get(), 2);
    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numNotifications.get(), 2);
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
    assert.deepEqual(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numNotifications.get(), 2);

    // Server hasn't caught up yet — still reports 3. Badge should stay at 2.
    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 2);

    // Server catches up.
    unreadAcceptedConvos = 2;
    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 2);
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
    assert.deepEqual(service.$numNotifications.get(), 3);

    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numNotifications.get(), 2);

    // Next poll: server caught up.
    unreadAcceptedConvos = 2;
    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 2);

    // Server later re-flags convo "a" (e.g. new message) — count goes back up.
    unreadAcceptedConvos = 3;
    await service.fetchNumNotifications();
    assert.deepEqual(service.$numNotifications.get(), 3);

    // Reading "a" again should decrement, since the dedup set was cleared.
    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numNotifications.get(), 2);
  });

  it("should decrement the request count for request convos", async () => {
    const api = createMockApi({ unreadRequestConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 3);

    service.markNotificationsAsReadForConvo("a", { isRequest: true });
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 2);
    assert.deepEqual(service.$numNotifications.get(), 2);
  });

  it("should not decrement the request count for accepted convos", async () => {
    const api = createMockApi({
      unreadAcceptedConvos: 2,
      unreadRequestConvos: 3,
    });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    service.markNotificationsAsReadForConvo("a");
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 3);
  });

  it("should not decrement the request count twice for the same convo id", async () => {
    const api = createMockApi({ unreadRequestConvos: 3 });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    service.markNotificationsAsReadForConvo("a", { isRequest: true });
    service.markNotificationsAsReadForConvo("a", { isRequest: true });
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 2);
  });

  it("should not decrement the request count below zero", async () => {
    const api = createMockApi();
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    service.markNotificationsAsReadForConvo("a", { isRequest: true });
    assert.deepEqual(service.$numUnreadRequestConvos.get(), 0);
  });
});
