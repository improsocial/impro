import { TestSuite } from "../testSuite.js";
import { assertEquals, mock } from "../testHelpers.js";
import { ChatNotificationService } from "/js/chatNotificationService.js";

const t = new TestSuite("chatNotificationService");

// Mock API
function createMockApi({ convos = [] } = {}) {
  return {
    listConvos: async ({ readState }) => {
      if (readState === "unread") {
        return { convos };
      }
      return { convos: [] };
    },
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
    const convos = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const api = createMockApi({ convos });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 3);
  });

  it("should update $numNotifications signal when count changes", async () => {
    const convos = [{ id: "1" }];
    const api = createMockApi({ convos });
    const service = new ChatNotificationService(api);

    assertEquals(service.$numNotifications.get(), 0);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 1);
  });

  it("should handle empty convos", async () => {
    const api = createMockApi({ convos: [] });
    const service = new ChatNotificationService(api);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 0);
  });
});

t.describe("$numNotifications", (it) => {
  it("should reflect current notification count", async () => {
    const convos = [{ id: "1" }, { id: "2" }];
    const api = createMockApi({ convos });
    const service = new ChatNotificationService(api);

    assertEquals(service.$numNotifications.get(), 0);

    await service.fetchNumNotifications();

    assertEquals(service.$numNotifications.get(), 2);
  });
});

t.describe("markNotificationsAsReadForConvo", (it) => {
  it("should trigger a fetch", async () => {
    const listConvosFn = mock(async () => ({ convos: [{ id: "1" }] }));
    const api = { listConvos: listConvosFn };
    const service = new ChatNotificationService(api);

    await service.markNotificationsAsReadForConvo();

    assertEquals(listConvosFn.calls.length, 1);
  });
});

await t.run();
