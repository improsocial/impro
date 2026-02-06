export function createPost({ uri, text, authorHandle, authorDisplayName }) {
  const did = uri.split("/")[2];
  return {
    uri,
    cid: "bafyreitest" + uri.split("/").pop(),
    author: {
      did,
      handle: authorHandle,
      displayName: authorDisplayName,
      avatar: "",
      viewer: { muted: false, blockedBy: false },
      labels: [],
      createdAt: "2025-01-01T00:00:00.000Z",
    },
    record: {
      $type: "app.bsky.feed.post",
      text,
      createdAt: "2025-01-01T00:00:00.000Z",
      langs: ["en"],
    },
    replyCount: 0,
    repostCount: 0,
    likeCount: 5,
    quoteCount: 0,
    indexedAt: "2025-01-01T00:00:00.000Z",
    viewer: {},
    labels: [],
  };
}
