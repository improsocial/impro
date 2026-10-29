import { html, render } from "/js/lib/lit-html.js";
import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";
import "/js/components/app-icon.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { floatingComposeButtonTemplate } from "/js/templates/floatingComposeButton.template.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import {
  formatRelativeTime,
  batch,
  unique,
  TabScrollMemory,
  StickyFixer,
  classnames,
  getCurrentTimestamp,
} from "/js/utils.js";
import { Signal, ReactiveStore, SignalSet } from "/js/signals.js";
import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
} from "/js/router.js";
import {
  linkToNotificationActivity,
  linkToPost,
  linkToProfile,
  linkToStarterPack,
} from "/js/navigation.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import {
  cdnImageUrl,
  getDisplayName,
  getImagesFromPost,
  getVideoFromPost,
  isEmptyPost,
  isUnavailablePost,
  parseUri,
} from "/js/dataHelpers.js";
import { getGifFromPost } from "/js/embedHelpers.js";
import { profileBadgesTemplate } from "/js/templates/profileBadges.template.js";
import { getTimestampFromRkey } from "/js/atproto.js";
import { profileListItemTemplate } from "/js/templates/profileList.template.js";
import "/js/components/tab-bar.js";
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_GROUP_WINDOW_HOURS,
} from "/js/config.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/container-link.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
import { showToast } from "/js/toasts.js";

const SCROLLED_DOWN_LIMIT = 250;

function loadLatestButtonTemplate({ hasNew, onClick }) {
  return html`<button
    class=${classnames("load-latest-button", { "has-new": hasNew })}
    data-testid="load-latest-button"
    data-teststate=${hasNew ? "has-new" : "default"}
    aria-label="Load new notifications"
    @click=${() => onClick()}
  >
    <app-icon icon="arrow-up-line"></app-icon>
  </button>`;
}

function notificationItemTemplate({ type, href, isUnread, children }) {
  const unreadClass = isUnread ? "unread" : "";
  if (href) {
    return html`<container-link
      class="notification-item notification-item-clickable ${unreadClass}"
      data-testid="notification-item"
      data-teststate=${type}
      href=${href}
    >
      ${children}
    </container-link>`;
  }
  return html`<div
    class="notification-item ${unreadClass}"
    data-testid="notification-item"
    data-teststate=${type}
  >
    ${children}
  </div>`;
}

export default async function notificationsView({
  root,
  layout,
  context: {
    auth,
    dataLayer,
    notificationService,
    postComposerService,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  await auth.requireAuth();

  function postPreviewTemplate({ post }) {
    if (!post) {
      return "";
    }

    if (isUnavailablePost(post)) {
      return html`<div class="notification-preview-text unavailable-post">
        Post unavailable
      </div>`;
    }

    const postPreview = post?.record?.text ? post.record.text : null;

    const images = getImagesFromPost(post);
    const video = getVideoFromPost(post);
    const gif = getGifFromPost(post);

    if (
      postPreview === null &&
      images.length === 0 &&
      video === null &&
      gif === null
    ) {
      return null;
    }

    return html`
      <div class="notification-preview">
        ${postPreview
          ? html`<div class="notification-preview-text">${postPreview}</div>`
          : ""}
        ${images.length > 0
          ? html`
              <div class="notification-preview-images">
                ${images
                  .slice(0, 4)
                  .map(
                    (image) => html`
                      <img
                        src="${cdnImageUrl(image.thumb)}"
                        alt="${image.alt || ""}"
                        class="notification-preview-image"
                      />
                    `,
                  )}
              </div>
            `
          : ""}
        ${video
          ? html`
              <div class="notification-preview-video">
                <img
                  src="${cdnImageUrl(video.thumbnail)}"
                  alt="${video.alt || ""}"
                />
                <div class="video-preview-play-button"></div>
                ${video.presentation === "gif"
                  ? html`<div class="gif-preview-badge" data-testid="gif-badge">
                      GIF
                    </div>`
                  : ""}
              </div>
            `
          : ""}
        ${gif
          ? html`
              <div class="notification-preview-video">
                <img src="${cdnImageUrl(gif.thumb)}" alt="${gif.alt}" />
                <div class="video-preview-play-button"></div>
                <div class="gif-preview-badge" data-testid="gif-badge">GIF</div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  const { postInteractionHandler } = interactionHandlers;

  const state = new ReactiveStore("notificationsView");
  state.$activeTab = new Signal.State("all");
  state.$isReloadingNotifications = new Signal.State(false);
  state.$isReloadingMentionNotifications = new Signal.State(false);
  state.$loadMoreError = new Signal.State(null);
  state.$mentionLoadMoreError = new Signal.State(null);
  state.$expandedGroups = new SignalSet();
  state.$isScrolledDown = new Signal.State(false);

  async function handleMenuClick() {
    layout.openSidebar();
  }

  const GROUPED_NOTIFICATION_TYPES = [
    "like",
    "follow",
    "repost",
    "like-via-repost",
    "repost-via-repost",
    "feedgen-like",
    "starterpack-joined",
    "verified",
    "unverified",
    "subscribed-post",
  ];

  // Check if you're following the author of the notification,
  // and the notification was created after you followed them.
  function isFollowBackNotification(notification) {
    if (notification.reason !== "follow") return false;
    const viewerFollowing = notification.author?.viewer?.following;
    if (!viewerFollowing) return false;
    const { rkey: followingRkey } = parseUri(viewerFollowing);
    const followingTimestamp = getTimestampFromRkey(followingRkey);
    if (followingTimestamp === null) return false;
    const followedTimestamp =
      new Date(notification.record?.createdAt).getTime() * 1000;
    return followedTimestamp > followingTimestamp;
  }

  function isWithinGroupWindow(notificationGroup, notification) {
    const head = notificationGroup.notifications[0];
    const ageDifferenceMs =
      new Date(head.indexedAt) - new Date(notification.indexedAt);
    return ageDifferenceMs < NOTIFICATION_GROUP_WINDOW_HOURS * 60 * 60 * 1000;
  }

  function groupNotificationsForBatch(notifications) {
    const notificationGroups = [];

    notifications.forEach((notification) => {
      const reason = notification.reason;
      const subject = notification.reasonSubject;

      const isFollowBackNotif = isFollowBackNotification(notification);
      const type = isFollowBackNotif ? "follow-back" : reason;
      const starterPack = notification.starterPack ?? null;

      const existingGroup = notificationGroups.find(
        (group) =>
          group.type === type &&
          group.subject === subject &&
          group.starterPack?.uri === starterPack?.uri &&
          isWithinGroupWindow(group, notification),
      );

      if (existingGroup && GROUPED_NOTIFICATION_TYPES.includes(type)) {
        existingGroup.notifications.push(notification);
      } else {
        notificationGroups.push({
          type,
          subject,
          starterPack,
          notifications: [notification],
        });
      }
    });

    return notificationGroups;
  }

  function shouldHideNotificationGroup(notificationGroup) {
    const { type, notifications } = notificationGroup;
    if (
      type === "like" ||
      type === "repost" ||
      type === "like-via-repost" ||
      type === "repost-via-repost"
    ) {
      const subject = notifications[0]?.subject;
      return !subject || isEmptyPost(subject);
    }
    if (type === "reply" || type === "mention" || type === "quote") {
      const post = notifications[0]?.post;
      return !post || isEmptyPost(post);
    }
    return false;
  }

  function isUnavailableSubscribedPost(notification) {
    return (
      notification.reason === "subscribed-post" &&
      (!notification.post || isEmptyPost(notification.post))
    );
  }

  function groupNotificationsByType(notifications) {
    if (!notifications) {
      return null;
    }
    // Only group notifications per page
    const batchedNotifications = batch(notifications, NOTIFICATIONS_PAGE_SIZE);
    return batchedNotifications
      .flatMap((batch) =>
        groupNotificationsForBatch(
          batch.filter(
            (notification) => !isUnavailableSubscribedPost(notification),
          ),
        ),
      )
      .filter(
        (notificationGroup) => !shouldHideNotificationGroup(notificationGroup),
      );
  }

  function toggleAuthorsExpanded(groupKey) {
    if (state.$expandedGroups.has(groupKey)) {
      state.$expandedGroups.delete(groupKey);
    } else {
      state.$expandedGroups.add(groupKey);
    }
  }

  function notificationAvatarsTemplate({ notificationGroup, maxAvatars = 5 }) {
    const authors = unique(
      notificationGroup.notifications.map(
        (notification) => notification.author,
      ),
      { by: "did" },
    );
    if (authors.length === 1) {
      return html`
        <div class="notification-avatars">
          <div class="notification-avatar">
            ${avatarTemplate({ author: authors[0] })}
          </div>
        </div>
      `;
    }
    const groupKey = notificationGroup.notifications[0].uri;
    if (state.$expandedGroups.has(groupKey)) {
      return html`
        <button
          type="button"
          class="notification-authors-toggle notification-authors-hide"
          data-testid="notification-authors-toggle"
          data-teststate="expanded"
          @click=${() => toggleAuthorsExpanded(groupKey)}
        >
          <app-icon icon="chevron-up-line"></app-icon>
          Hide
        </button>
        <div
          class="notification-expanded-authors"
          data-testid="notification-expanded-authors"
        >
          ${authors.map((author) =>
            profileListItemTemplate({
              actor: author,
              isAuthenticated,
              currentUserDid: dataLayer.derived.$currentUser.get()?.did,
              profileInteractionHandler:
                interactionHandlers.profileInteractionHandler,
              compact: true,
            }),
          )}
        </div>
      `;
    }
    return html`
      <div class="notification-avatars">
        ${authors
          .slice(0, maxAvatars)
          .map(
            (author) => html`
              <div class="notification-avatar">
                ${avatarTemplate({ author })}
              </div>
            `,
          )}
        <button
          type="button"
          class="notification-authors-toggle notification-authors-show"
          data-testid="notification-authors-toggle"
          data-teststate="collapsed"
          aria-label="Show all users"
          @click=${() => toggleAuthorsExpanded(groupKey)}
        >
          ${authors.length > maxAvatars
            ? html`<div class="notification-more">
                +${authors.length - maxAvatars}
              </div>`
            : ""}
          <app-icon icon="chevron-down-line"></app-icon>
        </button>
      </div>
    `;
  }

  function notificationProfileNamesTemplate({ notificationGroup }) {
    const authors = unique(
      notificationGroup.notifications.map(
        (notification) => notification.author,
      ),
      { by: "did" },
    );
    const firstAuthor = authors[0];
    const displayName = getDisplayName(firstAuthor);
    const otherCount = authors.length - 1;
    return html`<span
      ><a class="notification-profile-link" href="${linkToProfile(firstAuthor)}"
        >${displayName}</a
      >${profileBadgesTemplate({ profile: firstAuthor })}${otherCount > 0
        ? html`<span>
            and
            <strong
              >${otherCount} ${otherCount === 1 ? "other" : "others"}</strong
            ></span
          >`
        : ""}
    </span>`;
  }

  function followNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    return html`
      <div
        class="notification-item ${isUnread ? "unread" : ""}"
        data-testid="notification-item"
        data-teststate=${notificationGroup.type}
      >
        <div class="notification-icon">
          <app-icon icon="user-plus"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })}
            ${notificationGroup.type === "follow-back"
              ? "followed you back"
              : "followed you"}
            <span class="notification-time">· ${timeAgo}</span>
          </div>
          ${followedViaStarterPackTemplate({
            starterPack: notificationGroup.starterPack,
          })}
        </div>
      </div>
    `;
  }

  function followedViaStarterPackTemplate({ starterPack }) {
    if (!starterPack) return "";
    return html`
      <div
        class="notification-via-starter-pack"
        data-testid="notification-via-starter-pack"
      >
        via Starter Pack
        <a
          class="notification-starter-pack-link"
          href="${linkToStarterPack(starterPack)}"
          ><img
            class="notification-starter-pack-icon"
            src="/img/starter-pack-avatar-fallback.svg"
            alt=""
          />${starterPack.record.name}</a
        >
      </div>
    `;
  }

  function subscribedPostNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const post = firstNotif.post;
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    return notificationItemTemplate({
      type: notificationGroup.type,
      href: linkToNotificationActivity(
        notifications.map((notification) => notification.post.uri),
      ),
      isUnread,
      children: html`
        <div class="notification-icon">
          <app-icon icon="bell"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notifications.length === 1 ? "New post from" : "New posts from"}
            ${notificationProfileNamesTemplate({ notificationGroup })}
            <span class="notification-time">· ${timeAgo}</span>
          </div>
          ${postPreviewTemplate({ post: post })}
        </div>
      `,
    });
  }

  function likeNotificationTemplate({ notificationGroup, isRepost = false }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;

    // Get the liked post for preview
    const likedPost = firstNotif.subject;

    return notificationItemTemplate({
      type: notificationGroup.type,
      href: isUnavailablePost(likedPost) ? null : linkToPost(likedPost),
      isUnread,
      children: html`
        <div class="notification-icon">
          <app-icon icon="like"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })} liked
            ${isRepost ? "your repost" : "your post"}
            <span class="notification-time">· ${timeAgo}</span>
          </div>
          ${postPreviewTemplate({ post: likedPost })}
        </div>
      `,
    });
  }

  function repostNotificationTemplate({ notificationGroup, isRepost = false }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;

    // Get the reposted post for preview
    const repostedPost = firstNotif.subject;
    return notificationItemTemplate({
      type: notificationGroup.type,
      href: isUnavailablePost(repostedPost) ? null : linkToPost(repostedPost),
      isUnread,
      children: html`
        <div class="notification-icon"><app-icon icon="repost"></app-icon></div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })}
            ${isRepost ? "reposted your repost" : "reposted your post"}
            <span class="notification-time">· ${timeAgo}</span>
          </div>
          ${postPreviewTemplate({ post: repostedPost })}
        </div>
      `,
    });
  }

  function replyNotificationTemplate({ notificationGroup, currentUser }) {
    const { notifications } = notificationGroup;
    const notification = notifications[0];
    const post = notification.post;
    const replyToAuthor = notification.parentPost?.author || null;
    const isUnread = !notification.isRead;
    return html`
      <div class="notification-reply-wrapper ${isUnread ? "unread" : ""}">
        ${smallPostTemplate({
          post,
          currentUser,
          isAuthenticated,
          ignoreContentWarning: true,
          isUserPost: currentUser?.did === post.author?.did,
          showReplyToLabel: !!replyToAuthor,
          replyToAuthor,
          postInteractionHandler,
          ignoreMuteWarning: true,
          pluginService,
        })}
      </div>
    `;
  }

  function feedgenLikeNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    const subjectUri = notificationGroup.subject;
    const { repo, rkey } = subjectUri ? parseUri(subjectUri) : {};
    const subjectLink = repo && rkey ? `/profile/${repo}/feed/${rkey}` : null;

    return notificationItemTemplate({
      type: notificationGroup.type,
      href: subjectLink,
      isUnread,
      children: html`
        <div class="notification-icon">
          <app-icon icon="like"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })} liked
            your custom feed
            <span class="notification-time">· ${timeAgo}</span>
          </div>
        </div>
      `,
    });
  }

  function starterpackJoinedNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    const subjectUri = notificationGroup.subject;
    const { repo, rkey } = subjectUri ? parseUri(subjectUri) : {};
    const subjectLink =
      repo && rkey ? `/profile/${repo}/starter-pack/${rkey}` : null;

    return notificationItemTemplate({
      type: notificationGroup.type,
      href: subjectLink,
      isUnread,
      children: html`
        <div class="notification-icon">
          <app-icon icon="user"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })} signed up
            with your starter pack
            <span class="notification-time">· ${timeAgo}</span>
          </div>
        </div>
      `,
    });
  }

  function verifiedNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;

    return html`
      <div
        class="notification-item ${isUnread ? "unread" : ""}"
        data-testid="notification-item"
        data-teststate=${notificationGroup.type}
      >
        <div class="notification-icon verified-icon">
          <app-icon icon="verified-check"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })} verified
            you
            <span class="notification-time">· ${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }

  function unverifiedNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    const otherCount = notifications.length - 1;

    return html`
      <div
        class="notification-item ${isUnread ? "unread" : ""}"
        data-testid="notification-item"
        data-teststate=${notificationGroup.type}
      >
        <div class="notification-icon unverified-icon">
          <app-icon icon="verified-check"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            ${notificationProfileNamesTemplate({ notificationGroup })} removed
            their ${otherCount > 0 ? "verifications" : "verification"} from your
            account
            <span class="notification-time">· ${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }

  function contactMatchNotificationTemplate({ notificationGroup }) {
    const { notifications } = notificationGroup;
    const firstNotif = notifications[0];
    const timeAgo = formatRelativeTime(firstNotif.indexedAt);
    const isUnread = !firstNotif.isRead;
    const displayName = getDisplayName(firstNotif.author);
    const profileLink = linkToProfile(firstNotif.author);

    return notificationItemTemplate({
      type: notificationGroup.type,
      href: profileLink,
      isUnread,
      children: html`
        <div class="notification-icon">
          <app-icon icon="user-box"></app-icon>
        </div>
        <div class="notification-content">
          ${notificationAvatarsTemplate({ notificationGroup })}
          <div class="notification-text">
            Your contact
            <a class="notification-profile-link" href="${profileLink}"
              >${displayName}</a
            >${profileBadgesTemplate({ profile: firstNotif.author })} is on
            Bluesky
            <span class="notification-time">· ${timeAgo}</span>
          </div>
        </div>
      `,
    });
  }

  function notificationGroupTemplate({ notificationGroup, currentUser }) {
    const { type } = notificationGroup;
    if (type === "follow" || type === "follow-back") {
      return followNotificationTemplate({ notificationGroup });
    }
    if (type === "like") {
      return likeNotificationTemplate({ notificationGroup });
    }
    if (type === "like-via-repost") {
      return likeNotificationTemplate({
        notificationGroup,
        isRepost: true,
      });
    }
    if (type === "repost") {
      return repostNotificationTemplate({ notificationGroup });
    }
    if (type === "repost-via-repost") {
      return repostNotificationTemplate({
        notificationGroup,
        isRepost: true,
      });
    }
    if (type === "reply" || type === "mention" || type === "quote") {
      return replyNotificationTemplate({ notificationGroup, currentUser });
    }
    if (type === "subscribed-post") {
      return subscribedPostNotificationTemplate({ notificationGroup });
    }
    if (type === "feedgen-like") {
      return feedgenLikeNotificationTemplate({ notificationGroup });
    }
    if (type === "starterpack-joined") {
      return starterpackJoinedNotificationTemplate({ notificationGroup });
    }
    if (type === "verified") {
      return verifiedNotificationTemplate({ notificationGroup });
    }
    if (type === "unverified") {
      return unverifiedNotificationTemplate({ notificationGroup });
    }
    if (type === "contact-match") {
      return contactMatchNotificationTemplate({ notificationGroup });
    }
    return html`<div class="notification-item">
      Unknown notification type: ${type}
    </div>`;
  }

  function notificationsErrorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state" data-testid="notifications-error">
      <div>There was an error loading notifications.</div>
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  function loadMoreErrorTemplate({ onRetry }) {
    return html`<div
      class="error-state error-state-inline"
      data-testid="notifications-load-more-error"
    >
      <div>There was an error loading notifications.</div>
      ${tryAgainButtonTemplate({ onClick: onRetry })}
    </div>`;
  }

  function notificationsTemplate({
    groupedNotifications,
    hasMore,
    currentUser,
    loadMore,
    loadMoreError,
  }) {
    try {
      return paginatedListTemplate({
        items: groupedNotifications,
        renderItem: (notificationGroup) =>
          notificationGroupTemplate({ notificationGroup, currentUser }),
        renderSkeletonItem: postSkeletonTemplate,
        hasMore,
        onLoadMore: loadMore,
        emptyMessage: "No notifications yet!",
        endMessage: "No more notifications",
        errorTemplate: loadMoreError
          ? loadMoreErrorTemplate({ onRetry: loadMore })
          : null,
      });
    } catch (error) {
      console.error(error);
      return notificationsErrorTemplate({ error });
    }
  }

  async function scrollAndReloadNotifications() {
    if (window.scrollY > 0) {
      window.scrollTo({ top: -1, behavior: "smooth" });
    }
    const $isReloading =
      state.$activeTab.get() === "all"
        ? state.$isReloadingNotifications
        : state.$isReloadingMentionNotifications;
    $isReloading.set(true);
    try {
      await reloadTabs();
    } finally {
      $isReloading.set(false);
    }
  }

  const tabScroll = new TabScrollMemory();
  let pendingSeenAt = null;

  async function handleTabClick(tab) {
    const currentTab = state.$activeTab.get();
    if (tab === currentTab) {
      scrollAndReloadNotifications();
      return;
    }
    const switched = await tabScroll.switch(currentTab, tab, () =>
      state.$activeTab.set(tab),
    );
    if (!switched) return;
    if (tab === "all" && pendingSeenAt) {
      notificationService.markNotificationsAsRead(pendingSeenAt);
      pendingSeenAt = null;
    }
    if (tab === "mentions" && !dataLayer.derived.$mentionNotifications.get()) {
      await loadMentionNotifications({ reload: true });
    }
  }

  bindToPage(root, layout, "active-nav-click", (event) => {
    event.preventDefault();
    scrollAndReloadNotifications();
  });

  bindToPage(root, window, "notification-open", () => {
    scrollAndReloadNotifications();
  });

  bindToPage(root, window, "scroll", () => {
    state.$isScrolledDown.set(window.scrollY > SCROLLED_DOWN_LIMIT);
  });

  bindPageTitle(root, () => "Notifications");

  pageEffect(root, () => {
    const activeTab = state.$activeTab.get();
    const currentUser = dataLayer.derived.$currentUser.get();
    const notifications = dataLayer.derived.$notifications.get();
    const notificationsRequestStatus =
      dataLayer.requests.statusStore.$statuses.get("loadNotifications");
    const groupedNotifications = groupNotificationsByType(notifications);
    const cursor = dataLayer.derived.$notificationCursor.get();
    const hasMore = !!cursor;

    const mentionNotifications = dataLayer.derived.$mentionNotifications.get();
    const mentionNotificationsRequestStatus =
      dataLayer.requests.statusStore.$statuses.get("loadMentionNotifications");
    const groupedMentionNotifications =
      groupNotificationsByType(mentionNotifications);
    const mentionCursor = dataLayer.derived.$mentionNotificationCursor.get();
    const mentionHasMore = !!mentionCursor;

    const hasNew =
      activeTab === "all" &&
      notificationService.$numNotifications.get() > 0 &&
      !notificationsRequestStatus.loading;
    const showLoadLatestButton = state.$isScrolledDown.get() || hasNew;

    const isLoading =
      activeTab === "all"
        ? notificationsRequestStatus.loading &&
          state.$isReloadingNotifications.get() &&
          !!notifications
        : mentionNotificationsRequestStatus.loading &&
          state.$isReloadingMentionNotifications.get() &&
          !!mentionNotifications;

    render(
      html`<div id="notifications-view">
        ${headerTemplate({
          title: "Notifications",
          showLoadingSpinner: isLoading,
          leftButton: "menu",
          onClickMenuButton: handleMenuClick,
          bottomItemTemplate: () => html`
            <tab-bar
              .tabs=${[
                { value: "all", label: "All" },
                { value: "mentions", label: "Mentions" },
              ]}
              active-tab=${activeTab}
              full-width
              @tab-click=${(event) => handleTabClick(event.detail)}
            ></tab-bar>
          `,
        })}
        <main>
          <div class="notifications-feed" ?hidden=${activeTab !== "all"}>
            ${(() => {
              if (notificationsRequestStatus.error && !groupedNotifications) {
                return notificationsErrorTemplate({
                  error: notificationsRequestStatus.error,
                });
              }
              return notificationsTemplate({
                groupedNotifications,
                currentUser,
                hasMore,
                loadMore: loadMoreNotifications,
                loadMoreError: state.$loadMoreError.get(),
              });
            })()}
          </div>
          <div class="notifications-feed" ?hidden=${activeTab !== "mentions"}>
            ${(() => {
              if (
                mentionNotificationsRequestStatus.error &&
                !groupedMentionNotifications
              ) {
                return notificationsErrorTemplate({
                  error: mentionNotificationsRequestStatus.error,
                });
              }
              if (!groupedMentionNotifications && activeTab !== "mentions") {
                return "";
              }
              return notificationsTemplate({
                groupedNotifications: groupedMentionNotifications,
                currentUser,
                hasMore: mentionHasMore,
                loadMore: loadMoreMentionNotifications,
                loadMoreError: state.$mentionLoadMoreError.get(),
              });
            })()}
          </div>
        </main>
        ${showLoadLatestButton
          ? loadLatestButtonTemplate({
              hasNew,
              onClick: scrollAndReloadNotifications,
            })
          : ""}
        ${isAuthenticated
          ? floatingComposeButtonTemplate({
              disabled: !currentUser,
              onClick: () => postComposerService.composePost({ currentUser }),
            })
          : ""}
      </div>`,
      root,
    );
  });

  const fixedHeader = new StickyFixer(() => root.querySelector("header"));
  onPageShow(root, () => fixedHeader.start());

  async function loadNotifications({ reload = false } = {}) {
    const seenAt = getCurrentTimestamp();
    await dataLayer.requests.loadNotifications({
      reload,
      limit: NOTIFICATIONS_PAGE_SIZE,
    });
    if (dataLayer.requests.statusStore.getError("loadNotifications")) return;
    if (state.$activeTab.get() === "all") {
      pendingSeenAt = null;
      notificationService.markNotificationsAsRead(seenAt);
    } else {
      pendingSeenAt = seenAt;
    }
  }

  async function loadMentionNotifications({ reload = false } = {}) {
    await dataLayer.requests.loadMentionNotifications({
      reload,
      limit: NOTIFICATIONS_PAGE_SIZE,
    });
  }

  async function loadMoreNotifications() {
    await loadNotifications();
    const loadError =
      dataLayer.requests.statusStore.getError("loadNotifications");
    state.$loadMoreError.set(loadError);
  }

  async function loadMoreMentionNotifications() {
    await loadMentionNotifications();
    const loadError = dataLayer.requests.statusStore.getError(
      "loadMentionNotifications",
    );
    state.$mentionLoadMoreError.set(loadError);
  }

  async function reloadNotifications() {
    const hadNotifications = !!dataLayer.derived.$notifications.get();
    await loadNotifications({ reload: true });
    const loadError =
      dataLayer.requests.statusStore.getError("loadNotifications");
    if (hadNotifications && loadError) {
      throw loadError;
    }
    state.$loadMoreError.set(null);
  }

  async function reloadMentionNotifications() {
    const hadNotifications = !!dataLayer.derived.$mentionNotifications.get();
    await loadMentionNotifications({ reload: true });
    const loadError = dataLayer.requests.statusStore.getError(
      "loadMentionNotifications",
    );
    if (hadNotifications && loadError) {
      throw loadError;
    }
    state.$mentionLoadMoreError.set(null);
  }

  // Reloads the active tab, and refreshes the hidden one in the background
  // (only once it has been loaded) so switching tabs doesn't show stale data
  async function reloadTabs() {
    const activeTab = state.$activeTab.get();
    if (activeTab === "mentions") {
      reloadNotifications().catch(console.warn);
    } else if (dataLayer.derived.$mentionNotifications.get()) {
      reloadMentionNotifications().catch(console.warn);
    }
    try {
      if (activeTab === "all") {
        await reloadNotifications();
      } else {
        await reloadMentionNotifications();
      }
    } catch (error) {
      console.warn(error);
      showToast("Couldn't refresh notifications", { style: "error" });
    }
  }

  onPageShow(root, async ({ scrollY }) => {
    state.$isScrolledDown.set(scrollY > SCROLLED_DOWN_LIMIT);
    if (scrollY <= SCROLLED_DOWN_LIMIT) {
      window.scrollTo(0, 0);
      await reloadTabs();
    }
  });
}
