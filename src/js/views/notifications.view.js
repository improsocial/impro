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
import { getImagesFromPost, isUnavailablePost } from "/js/dataHelpers.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
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

      // Get images from the post embed
      const images = getImagesFromPost(post);

      if (postPreview === null && images.length === 0) {
        return "";
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
    ];

    function groupNotificationsForBatch(notifications) {
      const notificationGroups = [];

      notifications.forEach((notification) => {
        const type = notification.reason;
        const subject = notification.reasonSubject;

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

    function groupNotificationsByType(notifications) {
      if (!notifications) {
        return null;
      }
      // Only group notifications per page
      const batchedNotifications = batch(
        notifications,
        NOTIFICATIONS_PAGE_SIZE,
      );
      return batchedNotifications.flatMap((batch) =>
        groupNotificationsForBatch(batch),
      );
    }

    function notificationAvatarsTemplate({ notifications, maxAvatars = 5 }) {
      const displayCount = Math.min(notifications.length, maxAvatars);
      return html`
        <div class="notification-avatars">
          ${notifications.slice(0, displayCount).map(
            (notif) => html`
              <div
                class="notification-avatar"
                @click=${(e) => {
                  // Prevent click from propagating to the notification item
                  // so we navigate to the profile, not the post
                  e.stopPropagation();
                }}
              >
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
        ><strong>${displayName}</strong>${otherCount > 0
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
              followed you <span class="notification-time">· ${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }

    function subscribedPostNotificationTemplate({ notificationGroup }) {
      const { notifications } = notificationGroup;
      const firstNotif = notifications[0];
      const post = firstNotif; // is looks like this has the post data, so let's just use it like a post...
      const timeAgo = displayRelativeTime(firstNotif.indexedAt);
      const isUnread = !firstNotif.isRead;
      const profileLink = linkToProfile(post.author);
      return html`
        <div
          @click=${() => {
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
              <a
                class="notification-profile-link"
                href="${profileLink}"
                @click=${(e) => e.stopPropagation()}
                >${post.author.displayName ?? post.author.handle}</a
              >
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
          @click=${() => {
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
          @click=${() => {
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
            isUserPost: currentUser?.did === post.author?.did,
            replyToAuthor,
            postInteractionHandler,
            overrideMutedWords: true,
          })}
        </div>
      `;
    }

    function notificationGroupTemplate({ notificationGroup, currentUser }) {
      const { type } = notificationGroup;
      if (type === "follow") {
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
                await loadNotifications();
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
      render(
        html`<div id="notifications-view">
          ${mainLayoutTemplate({
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "notifications",
            onClickActiveNavItem: async () => {
              window.scrollTo(0, 0);
              await loadNotifications({ reload: true });
            },
            showFloatingComposeButton: true,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              ${textHeaderTemplate({
                title: "Notifications",
                showLoadingSpinner:
                  notificationsRequestStatus.loading && !!notifications,
                leftButton: "menu",
                onClickMenuButton: handleMenuClick,
              })}
              <main class="notifications-main">
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
                    });
                  } else {
                    return notificationsSkeletonTemplate();
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
