import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { heartIconTemplate } from "/js/templates/icons/heartIcon.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { displayRelativeTime, batch } from "/js/utils.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { repostIconTemplate } from "/js/templates/icons/repostIcon.template.js";
import { linkToPost, linkToProfile } from "/js/navigation.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import {
  getImagesFromPost,
  getVideoFromPost,
  isUnavailablePost,
  parseUri,
} from "/js/dataHelpers.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { getTimestampFromRkey } from "/js/atproto.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import { verifiedCheckIconTemplate } from "/js/templates/icons/verifiedCheckIcon.template.js";
import { contactsIconTemplate } from "/js/templates/icons/contactsIcon.template.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { NOTIFICATIONS_PAGE_SIZE } from "/js/config.js";
import "/js/components/infinite-scroll-container.js";

class NotificationsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      reportService,
      isAuthenticated,
    },
  }) {
    await requireAuth();

    function postPreviewTemplate({ post }) {
      if (!post) {
        return "";
      }

      if (isUnavailablePost(post)) {
        return html`<div class="notification-preview-text unavailable-post">
          Post unavailable
        </div>`;
      }

      const postPreview =
        post?.record?.text || post?.record?.text === ""
          ? post.record.text
          : null;

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

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      reportService,
      {
        renderFunc: () => renderPage(),
      },
    );

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
        return !subject || isUnavailablePost(subject);
      }
      if (type === "reply" || type === "mention" || type === "quote") {
        const post = notifications[0]?.post;
        return !post || isUnavailablePost(post);
      }
      if (type === "subscribed-post") {
        return (
          !notificationGroup.subject ||
          isUnavailablePost(notificationGroup.subject)
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
            ${userIconTemplate({ filled: true })}
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
      return html`
        <div
          @click=${(e) => {
            // if the click is on an anchor, don't go to the post, but let it bubble up so the router can handle it.
            if (e.target.closest("a")) {
              return;
            }
            if (isUnavailablePost(post)) {
              return;
            }
            window.router.go(linkToPost(post));
          }}
          class="notification-item notification-item-clickable ${isUnread
            ? "unread"
            : ""}"
        >
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
        </div>
      `;
    }

    function likeNotificationTemplate({ notificationGroup, isRepost = false }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;

      // Get the liked post for preview
      const likedPost = firstNotif.subject;

      return html`
        <div
          @click=${(e) => {
            // if the click is on an anchor, don't go to the post, but let it bubble up so the router can handle it.
            if (e.target.closest("a")) {
              return;
            }
            if (isUnavailablePost(likedPost)) {
              return;
            }
            window.router.go(linkToPost(likedPost));
          }}
          class="notification-item notification-item-clickable ${isUnread
            ? "unread"
            : ""}"
        >
          <div class="notification-icon">${heartIconTemplate()}</div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })} liked
              ${isRepost ? "your repost" : "your post"}
              <span class="notification-time">· ${timeAgo}</span>
            </div>
            ${postPreviewTemplate({ post: likedPost })}
          </div>
        </div>
      `;
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
      return html`
        <div
          @click=${(e) => {
            // if the click is on an anchor, don't go to the post, but let it bubble up so the router can handle it.
            if (e.target.closest("a")) {
              return;
            }
            if (isUnavailablePost(repostedPost)) {
              return;
            }
            window.router.go(linkToPost(repostedPost));
          }}
          class="notification-item notification-item-clickable ${isUnread
            ? "unread"
            : ""}"
        >
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
        </div>
      `;
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
            overrideMutedWords: true,
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

      return html`
        <div
          @click=${(e) => {
            if (e.target.closest("a") || !subjectLink) return;
            window.router.go(subjectLink);
          }}
          class="notification-item ${subjectLink
            ? "notification-item-clickable"
            : ""} ${isUnread ? "unread" : ""}"
        >
          <div class="notification-icon">${heartIconTemplate()}</div>
          <div class="notification-content">
            ${notificationAvatarsTemplate({ notifications })}
            <div class="notification-text">
              ${notificationProfileNamesTemplate({ notificationGroup })} liked
              your custom feed
              <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
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

      return html`
        <div
          @click=${(e) => {
            if (e.target.closest("a") || !subjectLink) return;
            window.router.go(subjectLink);
          }}
          class="notification-item ${subjectLink
            ? "notification-item-clickable"
            : ""} ${isUnread ? "unread" : ""}"
        >
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
        </div>
      `;
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

      return html`
        <div
          @click=${(e) => {
            if (e.target.closest("a")) return;
            window.router.go(profileLink);
          }}
          class="notification-item notification-item-clickable ${isUnread
            ? "unread"
            : ""}"
        >
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
        </div>
      `;
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

    let activeTab = "all";

    async function handleTabClick(tab) {
      if (tab === activeTab) return;
      activeTab = tab;
      renderPage();
      window.scrollTo(0, 0);
      if (
        tab === "mentions" &&
        !dataLayer.selectors.getMentionNotifications()
      ) {
        await loadMentionNotifications({ reload: true });
      }
    }

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const notifications = dataLayer.selectors.getNotifications();
      const notificationsRequestStatus =
        dataLayer.requests.getStatus("loadNotifications");
      const groupedNotifications = groupNotificationsByType(notifications);
      const cursor = dataLayer.selectors.getNotificationCursor();
      const hasMore = !!cursor;

      const mentionNotifications =
        dataLayer.selectors.getMentionNotifications();
      const mentionNotificationsRequestStatus = dataLayer.requests.getStatus(
        "loadMentionNotifications",
      );
      const groupedMentionNotifications =
        groupNotificationsByType(mentionNotifications);
      const mentionCursor = dataLayer.selectors.getMentionNotificationCursor();
      const mentionHasMore = !!mentionCursor;

      const isLoading =
        activeTab === "all"
          ? notificationsRequestStatus.loading && !!notifications
          : mentionNotificationsRequestStatus.loading && !!mentionNotifications;

      render(
        html`<div id="notifications-view">
          ${mainLayoutTemplate({
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "notifications",
            onClickActiveNavItem: async () => {
              window.scrollTo(0, 0);
              if (activeTab === "all") {
                await loadNotifications({ reload: true });
              } else {
                await loadMentionNotifications({ reload: true });
              }
            },
            showFloatingComposeButton: true,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              ${textHeaderTemplate({
                title: "Notifications",
                showLoadingSpinner: isLoading,
                leftButton: "menu",
                onClickMenuButton: handleMenuClick,
                bottomItemTemplate: () =>
                  tabBarTemplate({
                    tabs: [
                      { value: "all", label: "All" },
                      { value: "mentions", label: "Mentions" },
                    ],
                    activeTab,
                    onTabClick: handleTabClick,
                  }),
              })}
              <main class="notifications-main" ?hidden=${activeTab !== "all"}>
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
              </main>
              <main
                class="notifications-main"
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
              </main>
            `,
          })}
        </div>`,
        root,
      );
    }

    async function loadNotifications({ reload = false } = {}) {
      const loadingPromise = dataLayer.requests.loadNotifications({
        reload,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      // Show loading state
      renderPage();
      await loadingPromise;
      renderPage();
      // can be called async
      notificationService.markNotificationsAsRead();
    }

    async function loadMentionNotifications({ reload = false } = {}) {
      const loadingPromise = dataLayer.requests.loadMentionNotifications({
        reload,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
      await loadNotifications({ reload: true });
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
        await loadNotifications({ reload: true });
      }
      renderPage();
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new NotificationsView();
