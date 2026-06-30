import { unique } from "/js/utils.js";
import { IN_APP_LINK_DOMAINS } from "/js/config.js";

export const INVALID_HANDLE = "handle.invalid";
export const MISSING_HANDLE = "missing.invalid";

export function isModerationList(list) {
  return list?.purpose === "app.bsky.graph.defs#modlist";
}

export function hasValidHandle(profile) {
  return (
    !!profile.handle &&
    profile.handle !== INVALID_HANDLE &&
    profile.handle !== MISSING_HANDLE
  );
}

export function avatarThumbnailUrl(avatarUrl) {
  if (!avatarUrl) {
    console.warn("avatarUrl is null");
    return "";
  }
  return avatarUrl.replace(
    "/img/avatar/plain/",
    "/img/avatar_thumbnail/plain/",
  );
}

export function parseUri(uri) {
  // e.g. at://did:plc:p572wxnsuoogcrhlfrlizlrb/app.bsky.feed.repost/3m47r3v7spm2b
  // -> { repo: "did:plc:p572wxnsuoogcrhlfrlizlrb", rkey: "3m47r3v7spm2b", collection: "app.bsky.feed.repost" }
  const [repo, collection, rkey] = uri.replace("at://", "").split("/");
  return { repo, collection, rkey };
}

export function buildUri({ repo, collection, rkey }) {
  return `at://${repo}/${collection}/${rkey}`;
}

export function getRKey(record) {
  return record.uri.split("/").pop();
}
export function getIsLiked(post) {
  return !!post.viewer?.like;
}
export function getQuotedPost(post) {
  const embed = post.embeds ? post.embeds[0] : post.embed;
  if (!embed) {
    return null;
  }
  if (embed.$type === "app.bsky.embed.record#view") {
    return embed.record;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return embed.record.record;
  }
  return null;
}

export function isBlockingUser(blockedQuote) {
  return blockedQuote.author.viewer?.blockedBy;
}

export function getBlockedQuote(post) {
  const quotedPost = getQuotedPost(post);
  if (!quotedPost) {
    return null;
  }
  if (quotedPost.$type === "app.bsky.embed.record#viewBlocked") {
    return quotedPost;
  }
  return null;
}

export function getMutedQuote(post) {
  const quotedPost = getQuotedPost(post);
  if (!quotedPost) {
    return null;
  }
  // Note - using a custom property here
  if (quotedPost.author?.viewer?.muted || quotedPost.hasMutedWord) {
    return true;
  }
  return false;
}

export function isMutedPost(post) {
  return post.author?.viewer?.muted || post.viewer?.hasMutedWord;
}

export function embedViewRecordToPostView(viewRecord) {
  return {
    uri: viewRecord.uri,
    cid: viewRecord.cid,
    author: viewRecord.author,
    record: viewRecord.value,
    embed: viewRecord.embeds?.[0],
    labels: viewRecord.labels,
    likeCount: viewRecord.likeCount,
    replyCount: viewRecord.replyCount,
    repostCount: viewRecord.repostCount,
    quoteCount: viewRecord.quoteCount,
    indexedAt: viewRecord.indexedAt,
  };
}

export function createEmbedFromPost(post) {
  const embed = {
    $type: "app.bsky.embed.record#viewRecord",
    author: { ...post.author },
    value: { ...post.record },
    uri: post.uri,
    cid: post.cid,
    indexedAt: post.indexedAt,
    labels: post.labels,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    quoteCount: post.quoteCount,
  };
  if (post.embed) {
    embed.embeds = [post.embed];
  }
  return embed;
}

export function createThreadViewPostFromPost(post) {
  return {
    $type: "app.bsky.feed.defs#threadViewPost",
    post: { ...post },
  };
}

export function flattenParents(postThread) {
  const parents = [];
  let current = postThread.parent;
  while (current) {
    parents.unshift(current);
    current = current.parent;
  }
  return parents;
}

export function getParentPosts(postThread) {
  return flattenParents(postThread)
    .map((parent) => parent.post)
    .filter(Boolean);
}

export function replaceTopParent(postThread, newParent) {
  let current = postThread.parent;
  if (!current) {
    throw new Error("No parent found");
  }
  // If the immediate parent has no parent, it is the top
  if (!current.parent) {
    return { ...postThread, parent: newParent };
  }
  // Otherwise, traverse to find the parent whose parent is the top
  while (current.parent?.parent) {
    current = current.parent;
  }
  current.parent = newParent;
  return postThread;
}

export function getReplyPosts(postThread) {
  if (!postThread.replies) {
    return [];
  }
  return postThread.replies.map((reply) => reply.post).filter(Boolean);
}

export function getReplyRootFromPost(post) {
  // If the post is not a reply, return the post itself
  return post.record?.reply?.root ?? { uri: post.uri, cid: post.cid };
}

export function getNestedReplyPosts(postThread) {
  if (!postThread.replies) {
    return [];
  }
  const posts = [];
  for (const reply of postThread.replies) {
    if (reply.post) {
      posts.push(reply.post);
    }
    posts.push(...getNestedReplyPosts(reply));
  }
  return posts;
}

function updateNested(objOrArray, updater) {
  if (Array.isArray(objOrArray)) {
    return objOrArray.map((item) => updateNested(item, updater));
  } else if (objOrArray !== null && typeof objOrArray === "object") {
    // Apply updater to the object itself before recursing
    const updated = updater(objOrArray);
    // If updater returns a different object, stop recursion
    if (updated !== objOrArray) {
      return updated;
    }
    const newObj = {};
    for (let key in objOrArray) {
      if (Object.prototype.hasOwnProperty.call(objOrArray, key)) {
        newObj[key] = updateNested(objOrArray[key], updater);
      }
    }
    return newObj;
  } else {
    return updater(objOrArray);
  }
}

export function replaceBlockedQuote(post, fullBlockedQuote) {
  return updateNested(post, (obj) => {
    if (
      obj.$type === "app.bsky.embed.record#viewBlocked" &&
      obj.uri === fullBlockedQuote.uri
    ) {
      return fullBlockedQuote;
    }
    return obj;
  });
}

export function markBlockedQuoteNotFound(post, uri) {
  return updateNested(post, (obj) => {
    if (obj.$type === "app.bsky.embed.record#viewBlocked" && obj.uri === uri) {
      return { ...obj, $type: "app.bsky.embed.record#viewNotFound", uri };
    }
    return obj;
  });
}

export function isBlockedPost(post) {
  return post.$type === "app.bsky.feed.defs#blockedPost";
}

export function isNotFoundPost(post) {
  return post.$type === "app.bsky.feed.defs#notFoundPost";
}

export function createNotFoundPost(uri) {
  return {
    $type: "app.bsky.feed.defs#notFoundPost",
    uri,
  };
}

export function isUnavailablePost(post) {
  return post.$type === "social.impro.feed.defs#unavailablePost";
}

export function createUnavailablePost(uri) {
  return {
    $type: "social.impro.feed.defs#unavailablePost",
    uri,
  };
}

export function isEmptyPost(post) {
  return isBlockedPost(post) || isNotFoundPost(post) || isUnavailablePost(post);
}

export function isPostView(post) {
  return post.$type === "app.bsky.feed.defs#postView";
}

export function isSelfOrFollowing(profile, userDid) {
  return profile.did === userDid || profile.viewer?.following;
}

export function getReplyAuthors(reply) {
  return {
    parentAuthor: reply?.parent?.author,
    grandparentAuthor: reply?.grandparentAuthor,
    rootAuthor: reply?.root?.author,
  };
}

export function getRootUri(feedItem) {
  const reply = feedItem.reply;
  if (reply && reply.root) {
    return reply.root.uri;
  }
  return feedItem.post.uri;
}

export function getPostLabels(post) {
  const authorLabels = post.author?.labels || [];
  const postLabels = post.labels || [];
  return [...authorLabels, ...postLabels];
}

export function getPostUrisFromNotifications(notifications) {
  const postUris = [];

  for (const notification of notifications) {
    // For likes and reposts, fetch the post
    if (notification.reason === "like" || notification.reason === "repost") {
      postUris.push(notification.reasonSubject);
    }
    // For replies, mentions and quotes, fetch the post and the parent post(s)
    else if (
      notification.reason === "reply" ||
      notification.reason === "mention" ||
      notification.reason === "quote"
    ) {
      postUris.push(notification.uri);
      if (notification.reasonSubject) {
        postUris.push(notification.reasonSubject);
      }
      if (notification.record?.reply?.parent?.uri) {
        postUris.push(notification.record.reply.parent.uri);
      }
      if (notification.record?.reply?.root?.uri) {
        postUris.push(notification.record.reply.root.uri);
      }
    } else if (notification.reason === "subscribed-post") {
      postUris.push(notification.uri);
    } else if (
      notification.reason === "like-via-repost" ||
      notification.reason === "repost-via-repost"
    ) {
      // Note, this is a post uri, not a repost uri.
      // That way, if we delete the repost, the post will still be available to display / navigate to.
      postUris.push(notification.record.subject.uri);
    }
  }
  return unique(postUris);
}

export function getPostUriFromRepost(repost) {
  return repost.value.subject.uri;
}

export function getPostUrisFromReposts(reposts) {
  return unique(reposts.map((repost) => getPostUriFromRepost(repost)));
}

export function getImagesFromPost(post) {
  if (post?.embed?.$type === "app.bsky.embed.images#view") {
    return post.embed.images;
  }
  if (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view") {
    if (post.embed.media?.$type === "app.bsky.embed.images#view") {
      return post.embed.media.images;
    }
  }
  return [];
}

export function getVideoFromPost(post) {
  if (post?.embed?.$type === "app.bsky.embed.video#view") {
    return post.embed;
  }
  if (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view") {
    if (post.embed.media?.$type === "app.bsky.embed.video#view") {
      return post.embed.media;
    }
  }
  return null;
}

const CHECK_MARKS_RE = /[\u2705\u2713\u2714\u2611]/gu;
const CONTROL_CHARS_RE =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const MULTIPLE_SPACES_RE = /[\s][\s\u200B]+/g;

// Strip out invalid characters to match behavior of social-app
function sanitizeDisplayName(displayName) {
  return displayName
    .replace(CHECK_MARKS_RE, "")
    .replace(CONTROL_CHARS_RE, "")
    .replace(MULTIPLE_SPACES_RE, " ")
    .trim();
}

export function getDisplayName(profile) {
  if (profile.displayName) {
    return sanitizeDisplayName(profile.displayName);
  }
  if (profile.handle === MISSING_HANDLE) {
    return "Deleted Account";
  } else if (profile.handle === INVALID_HANDLE) {
    return "Invalid Handle";
  }
  return profile.handle;
}

export function getLastInteraction(convo) {
  // Interaction = message or reaction
  const lastMessage = convo.lastMessage;
  const lastReaction = convo.lastReaction;
  if (!lastMessage && !lastReaction) {
    return null;
  }
  if (!lastMessage) {
    return lastReaction;
  } else if (!lastReaction) {
    return lastMessage;
  } else {
    return new Date(lastMessage.sentAt) >
      new Date(lastReaction.reaction.createdAt)
      ? lastMessage
      : lastReaction;
  }
}

export function getInteractionTimestamp(interaction) {
  switch (interaction.$type) {
    case "chat.bsky.convo.defs#messageView":
    case "chat.bsky.convo.defs#deletedMessageView":
    case "chat.bsky.convo.defs#systemMessageView":
      return interaction.sentAt;
    case "chat.bsky.convo.defs#messageAndReactionView":
      return interaction.reaction.createdAt;
    default:
      console.warn(`Unknown interaction type: ${interaction.$type}`);
      return null;
  }
}

const SYSTEM_MESSAGE_DISPLAY_TEXT = {
  "chat.bsky.convo.defs#systemMessageDataAddMember":
    "Someone was added to the group",
  "chat.bsky.convo.defs#systemMessageDataRemoveMember":
    "Someone was removed from the group",
  "chat.bsky.convo.defs#systemMessageDataMemberJoin":
    "Someone joined the group",
  "chat.bsky.convo.defs#systemMessageDataMemberLeave": "Someone left the group",
  "chat.bsky.convo.defs#systemMessageDataLockConvo": "Chat locked",
  "chat.bsky.convo.defs#systemMessageDataUnlockConvo": "Chat unlocked",
  "chat.bsky.convo.defs#systemMessageDataLockConvoPermanently": "Chat ended",
  "chat.bsky.convo.defs#systemMessageDataEditGroup": "Chat title changed",
  "chat.bsky.convo.defs#systemMessageDataCreateJoinLink": "Invite link created",
  "chat.bsky.convo.defs#systemMessageDataEditJoinLink": "Invite link edited",
  "chat.bsky.convo.defs#systemMessageDataEnableJoinLink": "Invite link enabled",
  "chat.bsky.convo.defs#systemMessageDataDisableJoinLink":
    "Invite link disabled",
};

const MEMBER_SYSTEM_MESSAGE_VERBS = {
  "chat.bsky.convo.defs#systemMessageDataAddMember": "was added to the group",
  "chat.bsky.convo.defs#systemMessageDataRemoveMember":
    "was removed from the group",
  "chat.bsky.convo.defs#systemMessageDataMemberJoin": "joined the group",
  "chat.bsky.convo.defs#systemMessageDataMemberLeave": "left the group",
};

export function getSystemMessageDisplayText(
  systemMessage,
  { memberName = null } = {},
) {
  const dataType = systemMessage.data?.$type;
  if (memberName) {
    const verb = MEMBER_SYSTEM_MESSAGE_VERBS[dataType];
    if (verb) {
      return `${memberName} ${verb}`;
    }
  }
  if (
    dataType === "chat.bsky.convo.defs#systemMessageDataEditGroup" &&
    systemMessage.data.newName
  ) {
    return `Chat title changed to ${systemMessage.data.newName}`;
  }
  return SYSTEM_MESSAGE_DISPLAY_TEXT[dataType] ?? "Chat updated";
}

function getSenderDisplayName(senderDid, { currentUser, profiles }) {
  if (senderDid === currentUser?.did) {
    return "You";
  }
  const sender = profiles.find((profile) => profile.did === senderDid);
  return sender ? getDisplayName(sender) : "Someone";
}

function getEmbedPreviewText(embed) {
  if (!embed) {
    return "";
  }
  if (embed.$type === "app.bsky.embed.record#view") {
    return "(quoted post)";
  }
  return "(embedded content)";
}

export function getConvoPreviewText(
  interaction,
  { currentUser, convo, profiles },
) {
  switch (interaction.$type) {
    case "chat.bsky.convo.defs#messageView": {
      const text = interaction.text || getEmbedPreviewText(interaction.embed);
      if (isGroupConvo(convo)) {
        const senderName = getSenderDisplayName(interaction.sender.did, {
          currentUser,
          profiles,
        });
        return `${senderName}: ${text}`;
      }
      return interaction.sender.did === currentUser?.did
        ? "You: " + text
        : text;
    }
    case "chat.bsky.convo.defs#messageAndReactionView": {
      let text = "";
      if (interaction.message) {
        text = interaction.message.text
          ? '"' + interaction.message.text + '"'
          : getEmbedPreviewText(interaction.message.embed);
      }
      const displayName = getSenderDisplayName(
        interaction.reaction.sender.did,
        { currentUser, profiles },
      );
      return `${displayName} reacted ${interaction.reaction.value} to ${text}`;
    }
    case "chat.bsky.convo.defs#deletedMessageView":
      return "Deleted message";
    case "chat.bsky.convo.defs#systemMessageView": {
      const memberDid = interaction.data?.member?.did;
      const memberProfile = memberDid
        ? profiles.find((profile) => profile.did === memberDid)
        : null;
      return getSystemMessageDisplayText(interaction, {
        memberName: memberProfile ? getDisplayName(memberProfile) : null,
      });
    }
    default:
      console.warn(`Unknown interaction type: ${interaction.$type}`);
      return "";
  }
}

export function getInteractionProfileDids(interaction) {
  if (!interaction) {
    return [];
  }
  return [
    interaction.sender?.did,
    interaction.message?.sender?.did,
    interaction.reaction?.sender?.did,
    interaction.data?.member?.did,
    interaction.data?.addedBy?.did,
    ...(interaction.reactions?.map((reaction) => reaction.sender?.did) ?? []),
    ...(interaction.message?.reactions?.map(
      (reaction) => reaction.sender?.did,
    ) ?? []),
  ].filter(Boolean);
}

// Group reactions by value
// Returns: [{ value, senders, count }, ...]
export function groupReactions(reactions) {
  const groups = new Map();
  for (const reaction of reactions || []) {
    const existing = groups.get(reaction.value);
    if (existing) {
      existing.senders.push(reaction.sender);
      existing.count += 1;
    } else {
      groups.set(reaction.value, {
        value: reaction.value,
        senders: [reaction.sender],
        count: 1,
      });
    }
  }
  return [...groups.values()];
}

export function getGroupConvoDetails(convo) {
  if (convo.kind?.$type === "chat.bsky.convo.defs#groupConvo") {
    return convo.kind;
  }
  return null;
}

export function isGroupConvo(convo) {
  return getGroupConvoDetails(convo) !== null;
}

export function getGroupConvoOwner(convo) {
  // The owner may have left the group, in which case there is no owner
  return (
    convo.members.find(
      (member) =>
        member.kind?.$type === "chat.bsky.actor.defs#groupConvoMember" &&
        member.kind.role === "owner",
    ) ?? null
  );
}

export function getLastInteractionTimestamp(convo) {
  const lastInteraction = getLastInteraction(convo);
  if (!lastInteraction) {
    return null;
  }
  return getInteractionTimestamp(lastInteraction);
}

export function doHideAuthorOnUnauthenticated(author) {
  const authorLabels = author.labels || [];
  return authorLabels.some((label) => label.val === "!no-unauthenticated");
}

export function isAutomatedAccount(profile) {
  const labels = profile?.labels || [];
  return labels.some((label) => label.val === "bot");
}

export function isLabelerProfile(profile) {
  return profile.associated?.labeler;
}

export function getLabelNameAndDescription(
  labelDefinition,
  preferredLang = "en",
) {
  const defaultName = labelDefinition.identifier;
  if (!labelDefinition.locales || labelDefinition.locales.length === 0) {
    return { name: defaultName, description: "" };
  }
  const locale =
    labelDefinition.locales.find((l) => l.lang === preferredLang) ||
    labelDefinition.locales[0];
  return {
    name: locale.name || defaultName,
    description: locale.description || "",
  };
}

export function getLabelerForLabel(label, labelers) {
  const matchingLabeler = labelers.find(
    (labeler) => labeler.creator.did === label.src,
  );
  return matchingLabeler ?? null;
}

export function getDefinitionForLabel(label, labeler) {
  return labeler.policies.labelValueDefinitions.find(
    (definition) => definition.identifier === label.val,
  );
}

export function isBadgeLabel(labelDefinition) {
  return !(
    labelDefinition.blurs === "media" || labelDefinition.blurs === "content"
  );
}

export function getDefaultLabelSetting(labelDefinition) {
  const defaultSetting = labelDefinition.defaultSetting;
  if (!defaultSetting || !["ignore", "warn", "hide"].includes(defaultSetting)) {
    return "warn";
  }
  return defaultSetting;
}

// https://docs.bsky.app/docs/advanced-guides/moderation
export const GLOBAL_LABELS = [
  {
    identifier: "!hide",
    configurable: false,
    defaultSetting: "hide",
    blurs: "content",
    severity: "alert",
    locales: [
      {
        lang: "en",
        name: "Content Hidden",
        description: "This content has been hidden by the moderators.",
      },
    ],
  },
  {
    identifier: "!warn",
    configurable: false,
    defaultSetting: "warn",
    blurs: "content",
    severity: "alert",
    locales: [
      {
        lang: "en",
        name: "Content Warning",
        description:
          "This content has received a general warning from moderators.",
      },
    ],
  },
  // Self-label values (users can apply to their own content)
  {
    identifier: "porn",
    configurable: true,
    defaultSetting: "hide",
    blurs: "media",
    severity: "none",
    adultOnly: true,
    locales: [
      {
        lang: "en",
        name: "Adult Content",
        description: "Explicit sexual images.",
      },
    ],
  },
  {
    identifier: "sexual",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    adultOnly: true,
    locales: [
      {
        lang: "en",
        name: "Sexually Suggestive",
        description: "Does not include nudity.",
      },
    ],
  },
  {
    identifier: "nudity",
    configurable: true,
    defaultSetting: "ignore",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Non-sexual Nudity",
        description: "E.g. artistic nudes.",
      },
    ],
  },
  {
    identifier: "graphic-media",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Graphic Media",
        description: "Explicit or potentially disturbing media.",
      },
    ],
  },
  // Legacy label (maps to graphic-media)
  {
    identifier: "gore",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Graphic Media",
        description: "Explicit or potentially disturbing media.",
      },
    ],
  },
];

export function getGlobalLabelDefinition(labelValue) {
  return GLOBAL_LABELS.find((label) => label.identifier === labelValue) ?? null;
}

export function isGlobalLabel(labelValue) {
  return GLOBAL_LABELS.some((label) => label.identifier === labelValue);
}

export function isPinnedPost(feedItem) {
  return feedItem.reason?.$type === "app.bsky.feed.defs#reasonPin";
}

export function getThreadgateAllowSettings(post) {
  // - undefined allow -> { type: "everybody" }
  // - empty allow array -> { type: "nobody" }
  // - otherwise -> array of { type: "mention" | "followers" | "following" | "list" | "unknown", list? }
  const threadgate = post?.threadgate;
  if (!threadgate || !threadgate.record) {
    return { type: "everybody" };
  }
  const allow = threadgate.record.allow;
  if (allow === undefined) {
    return { type: "everybody" };
  }
  if (allow.length === 0) {
    return { type: "nobody" };
  }
  const lists = threadgate.lists || [];
  return allow.map((rule) => {
    switch (rule.$type) {
      case "app.bsky.feed.threadgate#mentionRule":
        return { type: "mention" };
      case "app.bsky.feed.threadgate#followerRule":
        return { type: "followers" };
      case "app.bsky.feed.threadgate#followingRule":
        return { type: "following" };
      case "app.bsky.feed.threadgate#listRule":
        return {
          type: "list",
          list: lists.find((listView) => listView.uri === rule.list) ?? null,
        };
      default:
        return { type: "unknown" };
    }
  });
}

// Adds a feed item to the beginning of a feed, preserving pinned post position.
export function addFeedItemToFeed(feedItem, feed) {
  const newFeed = [];
  const pinnedPost = feed.find((item) => isPinnedPost(item));
  if (pinnedPost) {
    newFeed.push(pinnedPost);
  }
  newFeed.push(feedItem);
  newFeed.push(...feed.filter((item) => !isPinnedPost(item)));
  return newFeed;
}

// Returns a new feed with the given post pinned to the top. Any previously
// pinned item is unpinned. If the post is already in the feed it's removed
// from its old position, otherwise a new feed item is created.
export function pinPostInFeed(feed, post) {
  const reasonPin = { $type: "app.bsky.feed.defs#reasonPin" };
  const unpinned = feed
    .filter((item) => item.post?.uri !== post.uri)
    .map((item) =>
      isPinnedPost(item) ? { ...item, reason: undefined } : item,
    );
  return [{ post, reason: reasonPin }, ...unpinned];
}

// Returns a new feed with the given post unpinned. The item is left in place
// (a follow-up feed reload will move it to its natural chronological position).
export function unpinPostInFeed(feed, post) {
  return feed.map((item) =>
    isPinnedPost(item) && item.post?.uri === post.uri
      ? { ...item, reason: undefined }
      : item,
  );
}

export function canReplyToPost(post) {
  if (isBlockedPost(post) || isNotFoundPost(post) || isUnavailablePost(post)) {
    return false;
  }
  if (post.viewer?.replyDisabled) {
    return false;
  }
  return true;
}

function replaceEmbed(post, embed) {
  if (post.embeds) {
    return { ...post, embeds: [embed, ...post.embeds.slice(1)] };
  }
  return { ...post, embed };
}

function transformQuote(post, updater) {
  const embed = post.embeds ? post.embeds[0] : post.embed;
  if (!embed) return post;
  if (embed.$type === "app.bsky.embed.record#view") {
    const updated = updater(embed.record);
    if (updated === embed.record) return post;
    return replaceEmbed(post, { ...embed, record: updated });
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    const updated = updater(embed.record.record);
    if (updated === embed.record.record) return post;
    return replaceEmbed(post, {
      ...embed,
      record: { ...embed.record, record: updated },
    });
  }
  return post;
}

// Up to two levels deep
export function transformNestedQuotes(post, transform) {
  return transformQuote(post, (quotedPost) => {
    const updatedQuote = transform(quotedPost);
    return transformQuote(updatedQuote, (nestedQuotedPost) =>
      transform(nestedQuotedPost),
    );
  });
}

const CHAT_INVITE_PATH_REGEX = /^\/chat\/([a-zA-Z0-9]{7,10})$/;

export function getInviteCodeFromUrl(url) {
  if (!url) return null;
  let pathname;
  try {
    const parsed = new URL(
      url.startsWith("/") ? `https://bsky.app${url}` : url,
    );
    if (
      !url.startsWith("/") &&
      !IN_APP_LINK_DOMAINS.includes(parsed.hostname)
    ) {
      return null;
    }
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  return pathname.match(CHAT_INVITE_PATH_REGEX)?.[1] ?? null;
}

export function isInviteLinkUrl(url) {
  return getInviteCodeFromUrl(url) !== null;
}

export function getJoinLinkCodeFromEmbed(embed) {
  if (embed?.$type === "chat.bsky.embed.joinLink#view") {
    return embed.joinLinkPreview?.code ?? null;
  }
  if (embed?.$type === "app.bsky.embed.external#view") {
    return getInviteCodeFromUrl(embed.external?.uri);
  }
  return null;
}

export function getJoinLinkCodesFromPosts(posts) {
  return (posts ?? [])
    .map((post) => getJoinLinkCodeFromEmbed(post?.embed))
    .filter(Boolean);
}

export function getJoinLinkCodesFromMessages(messages) {
  return (messages ?? [])
    .map((message) => getJoinLinkCodeFromEmbed(message?.embed))
    .filter(Boolean);
}

export function attachJoinLinkPreviewToEmbed(embed, preview) {
  if (embed?.$type === "chat.bsky.embed.joinLink#view") {
    if (preview === embed.joinLinkPreview) return null;
    return { ...embed, joinLinkPreview: preview };
  }
  if (embed?.$type === "app.bsky.embed.external#view") {
    return {
      $type: "chat.bsky.embed.joinLink#view",
      joinLinkPreview: preview,
    };
  }
  return null;
}

const JOIN_LINK_PREVIEW_TYPE = "chat.bsky.group.defs#joinLinkPreviewView";

export function isAvailableJoinLinkPreview(preview) {
  return preview?.$type === JOIN_LINK_PREVIEW_TYPE;
}

export function getPostsFromPostThread(postThread) {
  const posts = [];
  if (postThread.post) {
    posts.push(postThread.post);
  }
  posts.push(...getParentPosts(postThread));
  posts.push(...getNestedReplyPosts(postThread));
  return unique(posts, { by: "uri" });
}

export function getPostsFromFeed(feed) {
  const posts = [];
  for (const feedItem of feed.feed) {
    posts.push(feedItem.post);
    if (feedItem.reply) {
      const root = feedItem.reply.root;
      if (root.$type === "app.bsky.feed.defs#postView") {
        posts.push(root);
      }
      const parent = feedItem.reply.parent;
      if (parent.$type === "app.bsky.feed.defs#postView") {
        posts.push(parent);
      }
    }
  }
  return unique(posts, { by: "uri" });
}
