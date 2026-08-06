import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GroupChatLinkService } from "/js/groupChatLinkService.js";

describe("GroupChatLinkService", () => {
  let navigations;
  let router;

  function makeService({ isAuthenticated = true, mutations = {} } = {}) {
    const dataLayer = { isAuthenticated, mutations };
    return new GroupChatLinkService(dataLayer, router);
  }

  beforeEach(() => {
    navigations = [];
    router = { go: (path) => navigations.push(path) };
  });

  describe("handleAction", () => {
    it("navigates to the convo for an open action", () => {
      const service = makeService();
      service.handleAction("open", { convo: { id: "convo-1" } });
      assert.deepEqual(navigations, ["/messages/convo-1"]);
    });

    it("falls back to the preview's convoId", () => {
      const service = makeService();
      service.handleAction("open", { convoId: "convo-2" });
      assert.deepEqual(navigations, ["/messages/convo-2"]);
    });

    it("does not navigate when the preview has no convo", () => {
      const service = makeService();
      service.handleAction("open", { code: "abc" });
      assert.deepEqual(navigations, []);
    });

    it("opens bsky.app instead of navigating when logged out", () => {
      const service = makeService({ isAuthenticated: false });
      const opened = [];
      const originalOpen = window.open;
      window.open = (...args) => opened.push(args);
      try {
        service.handleAction("open", { code: "abc", convoId: "convo-1" });
      } finally {
        window.open = originalOpen;
      }
      assert.deepEqual(navigations, []);
      assert.deepEqual(opened, [
        ["https://bsky.app/chat/abc", "_blank", "noopener"],
      ]);
    });
  });

  describe("handleJoinChatModalSubmit", () => {
    it("navigates to the convo when the join is accepted", async () => {
      const service = makeService({
        mutations: {
          requestJoinGroupChat: async () => ({
            status: "joined",
            convo: { id: "convo-3" },
          }),
        },
      });
      await service.handleJoinChatModalSubmit({ code: "abc" });
      assert.deepEqual(navigations, ["/messages/convo-3"]);
    });

    it("does not navigate when the join needs approval", async () => {
      const service = makeService({
        mutations: {
          requestJoinGroupChat: async () => ({ status: "pending" }),
        },
      });
      await service.handleJoinChatModalSubmit({
        code: "abc",
        requireApproval: true,
      });
      assert.deepEqual(navigations, []);
    });
  });
});
