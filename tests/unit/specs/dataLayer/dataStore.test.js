import { TestSuite } from "../../testSuite.js";
import { assertEquals } from "../../testHelpers.js";
import { DataStore } from "/js/dataLayer/dataStore.js";

const t = new TestSuite("DataStore");

t.describe("setPosts", (it) => {
  it("should insert multiple posts", () => {
    const dataStore = new DataStore();
    const posts = [
      { uri: "at://did:test/app.bsky.feed.post/1", record: { text: "one" } },
      { uri: "at://did:test/app.bsky.feed.post/2", record: { text: "two" } },
      { uri: "at://did:test/app.bsky.feed.post/3", record: { text: "three" } },
    ];
    dataStore.setPosts(posts);
    for (const post of posts) {
      assertEquals(dataStore.$posts.get(post.uri), post);
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
    assertEquals(
      dataStoreA.$posts.get(post.uri),
      dataStoreB.$posts.get(post.uri),
    );
  });
});

await t.run();
