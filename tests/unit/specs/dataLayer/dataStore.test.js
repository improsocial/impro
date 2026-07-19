import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataStore } from "/js/dataLayer/dataStore.js";

describe("setPosts", () => {
  it("should insert multiple posts", () => {
    const dataStore = new DataStore();
    const posts = [
      { uri: "at://did:test/app.bsky.feed.post/1", record: { text: "one" } },
      { uri: "at://did:test/app.bsky.feed.post/2", record: { text: "two" } },
      { uri: "at://did:test/app.bsky.feed.post/3", record: { text: "three" } },
    ];
    dataStore.setPosts(posts);
    for (const post of posts) {
      assert.deepEqual(dataStore.$posts.get(post.uri), post);
    }
  });

  it("should match $posts.set behavior when given a single post", () => {
    const dataStoreA = new DataStore();
    const dataStoreB = new DataStore();
    const post = {
      uri: "at://did:test/app.bsky.feed.post/solo",
      record: { text: "solo" },
    };
    dataStoreA.$posts.set(post.uri, post);
    dataStoreB.setPosts([post]);
    assert.deepEqual(
      dataStoreA.$posts.get(post.uri),
      dataStoreB.$posts.get(post.uri),
    );
  });
});

describe("setConvo", () => {
  it("should save the convo and prepend it to the loaded convo list", () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [{ id: "c1" }], cursor: "page2" });
    const convo = { id: "c2", status: "accepted" };

    dataStore.setConvo(convo);

    assert.deepEqual(dataStore.$convos.get("c2"), convo);
    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      ["c2", "c1"],
    );
    assert.deepEqual(dataStore.$convoList.get().cursor, "page2");
  });

  it("should replace an existing list entry instead of duplicating it", () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({
      convos: [{ id: "c1", unreadCount: 0 }],
      cursor: null,
    });

    dataStore.setConvo({
      id: "c1",
      status: "accepted",
      unreadCount: 2,
    });

    const list = dataStore.$convoList.get();
    assert.deepEqual(list.convos.length, 1);
    assert.deepEqual(list.convos[0].unreadCount, 2);
  });

  it("should leave unloaded lists null", () => {
    const dataStore = new DataStore();

    dataStore.setConvo({ id: "c1", status: "accepted" });

    assert.deepEqual(dataStore.$convos.get("c1").id, "c1");
    assert.deepEqual(dataStore.$convoList.get(), null);
    assert.deepEqual(dataStore.$convoRequestList.get(), null);
  });

  it("should route request convos to the request list", () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [], cursor: null });
    dataStore.$convoRequestList.set({ convos: [], cursor: null });

    dataStore.setConvo({ id: "c1", status: "request" });

    assert.deepEqual(dataStore.$convoList.get().convos, []);
    assert.deepEqual(
      dataStore.$convoRequestList.get().convos.map((listConvo) => listConvo.id),
      ["c1"],
    );
  });

  it("should move an accepted convo out of the request list", () => {
    const dataStore = new DataStore();
    dataStore.$convoList.set({ convos: [], cursor: null });
    dataStore.$convoRequestList.set({
      convos: [{ id: "c1", status: "request" }],
      cursor: null,
    });

    dataStore.setConvo({ id: "c1", status: "accepted" });

    assert.deepEqual(
      dataStore.$convoList.get().convos.map((listConvo) => listConvo.id),
      ["c1"],
    );
    assert.deepEqual(dataStore.$convoRequestList.get().convos, []);
  });
});
