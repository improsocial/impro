import { userProfile } from "./fixtures.js";

export class MockServer {
  constructor() {
    this.bookmarks = [];
  }

  addBookmarks(bookmarks) {
    this.bookmarks.push(...bookmarks);
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
        body: JSON.stringify({ convos: [] }),
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
