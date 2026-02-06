import { userProfile } from "./fixtures.js";

export class MockServer {
  constructor() {
    this.bookmarks = [];
    this.convos = [];
    this.convoMessages = new Map();
  }

  addBookmarks(bookmarks) {
    this.bookmarks.push(...bookmarks);
  }

  addConvos(convos) {
    this.convos.push(...convos);
  }

  addConvoMessages(convoId, messages) {
    this.convoMessages.set(convoId, messages);
  }

  async setup(page) {
    await page.route("**/xrpc/com.atproto.server.getSession*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          did: userProfile.did,
          handle: userProfile.handle,
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preferences: [] }),
      }),
    );

    await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ views: [] }),
      }),
    );

    await page.route("**/xrpc/app.bsky.notification.getUnreadCount*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0 }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.listConvos*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ convos: this.convos }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.getConvo*", (route) => {
      const url = new URL(route.request().url());
      const convoId = url.searchParams.get("convoId");
      const convo = this.convos.find((c) => c.id === convoId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ convo: convo || {} }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.getMessages*", (route) => {
      const url = new URL(route.request().url());
      const convoId = url.searchParams.get("convoId");
      const messages = this.convoMessages.get(convoId) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.sendMessage*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-sent-1",
          rev: "rev-sent-1",
          text: "",
          sender: { did: userProfile.did },
          sentAt: new Date().toISOString(),
        }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.updateRead*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.getLog*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ logs: [], cursor: "" }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.acceptConvo*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rev: "rev-accepted" }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.leaveConvo*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rev: "rev-left" }),
      }),
    );

    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userProfile),
      }),
    );

    await page.route("**/xrpc/app.bsky.bookmark.getBookmarks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bookmarks: this.bookmarks.map((post) => ({ item: post })),
        }),
      }),
    );
  }
}
