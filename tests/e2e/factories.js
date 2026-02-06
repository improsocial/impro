export function createConvo({
  id,
  otherMember,
  lastMessage,
  status = "accepted",
  unreadCount = 0,
}) {
  return {
    id,
    rev: "rev" + id,
    members: [
      {
        did: "did:plc:testuser123",
        handle: "testuser.bsky.social",
        displayName: "Test User",
        avatar: "",
        viewer: { muted: false, blockedBy: false },
        labels: [],
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      otherMember,
    ],
    status,
    unreadCount,
    lastMessage: lastMessage || undefined,
  };
}

export function createMessage({ id, text, senderDid, sentAt }) {
  return {
    $type: "chat.bsky.convo.defs#messageView",
    id,
    rev: "rev" + id,
    text,
    facets: [],
    sender: { did: senderDid },
    sentAt: sentAt || "2025-01-15T12:00:00.000Z",
    reactions: [],
  };
}

export function createProfile({ did, handle, displayName }) {
  return {
    did,
    handle,
    displayName,
    avatar: "",
    viewer: { muted: false, blockedBy: false },
    labels: [],
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

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
