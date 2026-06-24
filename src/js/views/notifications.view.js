import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { heartIconTemplate } from "/js/templates/icons/heartIcon.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { displayRelativeTime, batch } from "/js/utils.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { pageEffect } from "/js/router.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";
import { repostIconTemplate } from "/js/templates/icons/repostIcon.template.js";
import { linkToPost, linkToProfile } from "/js/navigation.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import {
  getImagesFromPost,
  getVideoFromPost,
  isEmptyPost,
  isUnavailablePost,
  parseUri,
} from "/js/dataHelpers.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { getTimestampFromRkey } from "/js/atproto.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import { verifiedCheckIconTemplate } from "/js/templates/icons/verifiedCheckIcon.template.js";
import { contactsIconTemplate } from "/js/templates/icons/contactsIcon.template.js";
import "/js/components/tab-bar.js";
import { NOTIFICATIONS_PAGE_SIZE } from "/js/config.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/container-link.js";

function notificationItemTemplate({ href, isUnread, children }) {
  const unreadClass = isUnread ? "unread" : "";
  if (href) {
    return html`<container-link
      class="notification-item notification-item-clickable ${unreadClass}"
      href=${href}
    >
      ${children}
    </container-link>`;
  }
  return html`<div class="notification-item ${unreadClass}">${children}</div>`;
}

class NotificationsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      isAuthenticated,
      pluginService,
      interactionHandlers,
      mainLayout,
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

      if (postPreview === null && images.length === 0 && video === null) {
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
                          src="${image.thumb}"
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
                  <img src="${video.thumbnail}" alt="${video.alt || ""}" />
                  <div class="video-preview-play-button"></div>
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

    async function handleMenuClick() {
      const sidebar = root.querySelector("animated-sidebar");
      sidebar.open();
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

    function groupNotificationsForBatch(notifications) {
      const notificationGroups = [];

      notifications.forEach((notification) => {
        const reason = notification.reason;
        const subject = notification.reasonSubject;

        const isFollowBackNotif = isFollowBackNotification(notification);
        const type = isFollowBackNotif ? "follow-back" : reason;

        const existingGroup = notificationGroups.find(
          (group) => group.type === type && group.subject === subject,
        );

        if (existingGroup && GROUPED_NOTIFICATION_TYPES.includes(type)) {
          existingGroup.notifications.push(notification);
        } else {
          notificationGroups.push({
            type,
            subject,
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
      if (type === "subscribed-post") {
        return (
          !notificationGroup.subject || isEmptyPost(notificationGroup.subject)
        );
      }
      return false;
    }

    function groupNotificationsByType(notifications) {
      if (!notifications) {
        return null;
      }
      // Only group notifications per page
      const batchedNotifications = batch(
        notifications,
        NOTIFICATIONS_PAGE_SIZE,
      );
      return batchedNotifications
        .flatMap((batch) => groupNotificationsForBatch(batch))
        .filter(
          (notificationGroup) =>
            !shouldHideNotificationGroup(notificationGroup),
        );
    }

    function notificationAvatarsTemplate({ notifications, maxAvatars = 5 }) {
      const displayCount = Math.min(notifications.length, maxAvatars);
      return html`
        <div class="notification-avatars">
          ${notifications
            .slice(0, displayCount)
            .map(
              (notif) => html`
                <div class="notification-avatar">
                  ${avatarTemplate({ author: notif.author })}
                </div>
              `,
            )}
          ${notifications.length > maxAvatars
            ? html`<div class="notification-more">
                +${notifications.length - maxAvatars}
              </div>`
            : ""}
        </div>
      `;
    }

    function notificationProfileNamesTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const displayName =
        firstNotif.author.displayName || firstNotif.author.handle;
      const otherCount = notifications.length - 1;
      return html`<span
        ><strong>${displayName}</strong>${verificationBadgeTemplate({
          profile: firstNotif.author,
        })}${automatedAccountBadgeTemplate({
          profile: firstNotif.author,
        })}${otherCount > 0
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
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      return html`
        <div class="notification-item ${isUnread ? "unread" : ""}">
          <div class="notification-icon">
            ${userPlusIconTemplate({ filled: true })}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })}
              ${notificationGroup.type === "follow-back"
                ? "followed you back"
                : "followed you"}
              <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }

    function subscribedPostNotificationTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const post = notificationGroup.subject;
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const profileLink = linkToProfile(post.author);
      return notificationItemTemplate({
        href: isUnavailablePost(post) ? null : linkToPost(post),
        isUnread,
        children: html`
          <div class="notification-icon">
            ${notificationsIconTemplate({ filled: true })}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              New post from
              <a class="notification-profile-link" href="${profileLink}"
                >${post.author.displayName ?? post.author.handle}</a
              >${verificationBadgeTemplate({
                profile: post.author,
              })}${automatedAccountBadgeTemplate({ profile: post.author })}
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
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;

      // Get the liked post for preview
      const likedPost = firstNotif.subject;

      return notificationItemTemplate({
        href: isUnavailablePost(likedPost) ? null : linkToPost(likedPost),
        isUnread,
        children: html`
          <div class="notification-icon">
            ${heartIconTemplate({ filled: true })}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
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

    function repostNotificationTemplate({
      notificationGroup,
      isRepost = false,
    }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;

      // Get the reposted post for preview
      const repostedPost = firstNotif.subject;
      return notificationItemTemplate({
        href: isUnavailablePost(repostedPost) ? null : linkToPost(repostedPost),
        isUnread,
        children: html`
          <div class="notification-icon">${repostIconTemplate()}</div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
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
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const subjectUri = notificationGroup.subject;
      const { repo, rkey } = subjectUri ? parseUri(subjectUri) : {};
      const subjectLink = repo && rkey ? `/profile/${repo}/feed/${rkey}` : null;

      return notificationItemTemplate({
        href: subjectLink,
        isUnread,
        children: html`
          <div class="notification-icon">
            ${heartIconTemplate({ filled: true })}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
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
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const subjectUri = notificationGroup.subject;
      const { repo, rkey } = subjectUri ? parseUri(subjectUri) : {};
      const subjectLink =
        repo && rkey ? `/profile/${repo}/starter-pack/${rkey}` : null;

      return notificationItemTemplate({
        href: subjectLink,
        isUnread,
        children: html`
          <div class="notification-icon">
            ${userIconTemplate({ filled: true })}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })} signed
              up with your starter pack
              <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        `,
      });
    }

    function verifiedNotificationTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;

      return html`
        <div class="notification-item ${isUnread ? "unread" : ""}">
          <div class="notification-icon verified-icon">
            ${verifiedCheckIconTemplate()}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })}
              verified you
              <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }

    function unverifiedNotificationTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const otherCount = notifications.length - 1;

      return html`
        <div class="notification-item ${isUnread ? "unread" : ""}">
          <div class="notification-icon unverified-icon">
            ${verifiedCheckIconTemplate()}
          </div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })} removed
              their ${otherCount > 0 ? "verifications" : "verification"} from
              your account
              <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }

    function contactMatchNotificationTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const displayName =
        firstNotif.author.displayName || firstNotif.author.handle;
      const profileLink = linkToProfile(firstNotif.author);

      return notificationItemTemplate({
        href: profileLink,
        isUnread,
        children: html`
          <div class="notification-icon">${contactsIconTemplate()}</div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              Your contact
              <a class="notification-profile-link" href="${profileLink}"
                >${displayName}</a
              >${verificationBadgeTemplate({
                profile: firstNotif.author,
              })}${automatedAccountBadgeTemplate({
                profile: firstNotif.author,
              })}
              is on Bluesky
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

    function notificationsSkeletonTemplate() {
      return html`
        ${Array.from({ length: 5 }).map(() => postSkeletonTemplate())}
      `;
    }

    function notificationsErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading notifications.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function notificationsTemplate({
      groupedNotifications,
      hasMore,
      currentUser,
      loadMore,
    }) {
      if (groupedNotifications.length === 0) {
        return html`<div class="feed-end-message">
          <div>No notifications yet!</div>
        </div>`;
      }
      try {
        return html`
          <infinite-scroll-container
            @load-more=${async (e) => {
              if (hasMore) {
                await loadMore();
                e.detail.resume();
              }
            }}
          >
            ${groupedNotifications.map((notificationGroup) =>
              notificationGroupTemplate({ notificationGroup, currentUser }),
            )}
            ${!hasMore
              ? html`<div class="feed-end-message">No more notifications</div>`
              : Array.from({ length: 5 }).map(() => postSkeletonTemplate())}
          </infinite-scroll-container>
        `;
      } catch (error) {
        console.error(error);
        return notificationsErrorTemplate({ error });
      }
    }

    async function scrollAndReloadNotifications() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      if (state.$activeTab.get() === "all") {
        state.$isReloadingNotifications.set(true);
        try {
          await loadNotifications({ reload: true });
        } finally {
          state.$isReloadingNotifications.set(false);
        }
      } else {
        state.$isReloadingMentionNotifications.set(true);
        try {
          await loadMentionNotifications({ reload: true });
        } finally {
          state.$isReloadingMentionNotifications.set(false);
        }
      }
    }

    async function handleTabClick(tab) {
      if (tab === state.$activeTab.get()) {
        scrollAndReloadNotifications();
        return;
      }
      state.$activeTab.set(tab);
      window.scrollTo(0, 0);
      if (
        tab === "mentions" &&
        !dataLayer.derived.$mentionNotifications.get()
      ) {
        await loadMentionNotifications({ reload: true });
      }
    }

    pageEffect(root, () => {
      const activeTab = state.$activeTab.get();
      const currentUser = dataLayer.derived.$currentUser.get();
      const notifications = dataLayer.derived.$notifications.get();
      const notificationsRequestStatus =
        dataLayer.requests.statusStore.$statuses.get("loadNotifications");
      const groupedNotifications = groupNotificationsByType(notifications);
      const cursor = dataLayer.derived.$notificationCursor.get();
      const hasMore = !!cursor;

      const mentionNotifications =
        dataLayer.derived.$mentionNotifications.get();
      const mentionNotificationsRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
          "loadMentionNotifications",
        );
      const groupedMentionNotifications =
        groupNotificationsByType(mentionNotifications);
      const mentionCursor = dataLayer.derived.$mentionNotificationCursor.get();
      const mentionHasMore = !!mentionCursor;

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
          ${mainLayout({
            activeNavItem: "notifications",
            onClickActiveNavItem: () => {
              scrollAndReloadNotifications();
            },
            showFloatingComposeButton: true,
            children: html`
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
                    if (notificationsRequestStatus.error) {
                      return notificationsErrorTemplate({
                        error: notificationsRequestStatus.error,
                      });
                    } else if (groupedNotifications) {
                      return notificationsTemplate({
                        groupedNotifications,
                        currentUser,
                        hasMore,
                        loadMore: loadNotifications,
                      });
                    } else {
                      return notificationsSkeletonTemplate();
                    }
                  })()}
                </div>
                <div
                  class="notifications-feed"
                  ?hidden=${activeTab !== "mentions"}
                >
                  ${(() => {
                    if (mentionNotificationsRequestStatus.error) {
                      return notificationsErrorTemplate({
                        error: mentionNotificationsRequestStatus.error,
                      });
                    } else if (groupedMentionNotifications) {
                      return notificationsTemplate({
                        groupedNotifications: groupedMentionNotifications,
                        currentUser,
                        hasMore: mentionHasMore,
                        loadMore: loadMentionNotifications,
                      });
                    } else if (activeTab === "mentions") {
                      return notificationsSkeletonTemplate();
                    } else {
                      return "";
                    }
                  })()}
                </div>
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    async function loadNotifications({ reload = false } = {}) {
      await dataLayer.requests.loadNotifications({
        reload,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      // can be called async
      notificationService.markNotificationsAsRead();
    }

    async function loadMentionNotifications({ reload = false } = {}) {
      await dataLayer.requests.loadMentionNotifications({
        reload,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await loadNotifications({ reload: true });
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
      if (scrollY <= 200) {
        await loadNotifications({ reload: true });
      }
    });
  }
}

export default new NotificationsView();
