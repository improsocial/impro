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

export function createFeedGenerator({ uri, displayName, creatorHandle }) {
  const creatorDid = uri.split("/")[2];
  return {
    uri,
    cid: "bafyreitest" + uri.split("/").pop(),
    did: `did:web:feed.${creatorHandle}`,
    creator: {
      did: creatorDid,
      handle: creatorHandle,
      displayName: creatorHandle.split(".")[0],
      avatar: "",
      viewer: { muted: false, blockedBy: false },
      labels: [],
      createdAt: "2025-01-01T00:00:00.000Z",
    },
    displayName,
    description: "",
    avatar: "",
    likeCount: 10,
    indexedAt: "2025-01-01T00:00:00.000Z",
    labels: [],
    viewer: {},
  };
}

export function createNotification({
  reason,
  author,
  reasonSubject,
  uri,
  isRead = false,
  indexedAt = "2025-01-15T12:00:00.000Z",
  record,
}) {
  return {
    uri: uri || `at://${author.did}/app.bsky.feed.like/notif-${Date.now()}`,
    cid: "bafyreinotif" + Math.random().toString(36).slice(2),
    author,
    reason,
    reasonSubject: reasonSubject || "",
    record: record || {},
    isRead,
    indexedAt,
    labels: [],
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
