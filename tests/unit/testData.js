import { createPost, createFeedItem } from "../shared/factories.js";

const authorDid = "did:plc:testauthor123";

export const post = createPost({
  uri: `at://${authorDid}/app.bsky.feed.post/3testpost2k`,
  text: "A test post about nothing in particular",
  authorHandle: "testauthor.bsky.social",
  authorDisplayName: "Test Author",
  authorAvatar: `https://cdn.bsky.app/img/avatar/plain/${authorDid}/bafkreitestavatar@jpeg`,
  viewer: { bookmarked: false, threadMuted: false, embeddingDisabled: false },
});

export const feed = [
  createFeedItem({ post }),
  createFeedItem({
    post: createPost({
      uri: "at://did:plc:otherauthor456/app.bsky.feed.post/3testpost3k",
      text: "A second test post",
      authorHandle: "otherauthor.bsky.social",
      authorDisplayName: "Other Author",
    }),
  }),
  createFeedItem({
    post: createPost({
      uri: "at://did:plc:thirdauthor789/app.bsky.feed.post/3testpost4k",
      text: "A third test post",
      authorHandle: "thirdauthor.bsky.social",
      authorDisplayName: "Third Author",
    }),
  }),
];
