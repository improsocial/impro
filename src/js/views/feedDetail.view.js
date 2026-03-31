import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import "/js/components/infinite-scroll-container.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { FeedInteractionHandler } from "/js/feedInteractionHandler.js";
import { FEED_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";

class FeedDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      notificationService,
      chatNotificationService,
      postComposerService,
      reportService,
    },
  }) {
    await requireAuth();

    const { handleOrDid, rkey } = params;

    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
    }
    const feedUri = `at://${profileDid}/app.bsky.feed.generator/${rkey}`;

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      reportService,
      {
        renderFunc: () => renderPage(),
      },
    );

    const feedInteractionHandler = new FeedInteractionHandler(dataLayer, {
      renderFunc: () => renderPage(),
    });

    async function renderPage() {
      const showLessInteractions =
        dataLayer.selectors.getShowLessInteractions() ?? [];
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const currentUser = dataLayer.selectors.getCurrentUser();
      const feedGenerator = dataLayer.selectors.getFeedGenerator(feedUri);
      const feedName = feedGenerator?.displayName || "";
      const feedAuthor = feedGenerator?.creator;
      const feedAuthorHandle = feedAuthor?.handle;
      const preferences = dataLayer.selectors.getPreferences();
      const isPinned = preferences.isFeedPinned(feedUri);
      render(
        html`<div id="feed-detail-view">
          ${mainLayoutTemplate({
            onClickActiveNavItem: () => {
              window.router.back();
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            numNotifications,
            numChatNotifications,
            currentUser,
            showSidebarOverlay: false,
            activeNavItem: null,
            children: html`${textHeaderTemplate({
                title: feedName,
                subtitle: feedAuthorHandle ? `@${feedAuthorHandle}` : "",
                rightItemTemplate: () => {
                  const feedLink = `https://bsky.app/profile/${feedAuthorHandle || handleOrDid}/feed/${rkey}`;
                  return html`<button
                      class="feed-menu-button"
                      @click=${function (e) {
                        const contextMenu = this.nextElementSibling;
                        contextMenu.open(e.clientX, e.clientY);
                      }}
                    >
                      <span>...</span>
                    </button>
                    <context-menu>
                      <context-menu-item
                        @click=${() => {
                          window.open(feedLink, "_blank");
                        }}
                      >
                        Open in bsky.app
                      </context-menu-item>
                      <context-menu-item
                        @click=${() => {
                          navigator.clipboard.writeText(feedLink);
                          showToast("Link copied to clipboard");
                        }}
                      >
                        Copy link to feed
                      </context-menu-item>
                    </context-menu>
                    <button
                      class=${classnames("pin-feed-button", {
                        pinned: isPinned,
                      })}
                      @click=${() => feedInteractionHandler.handlePinFeed(feedUri, !isPinned)}
                    >
                      ${pinIconTemplate({ filled: isPinned })}
                    </button>`;
                },
              })}
              <main>
                ${(() => {
                  const feed = dataLayer.selectors.getFeed(feedUri);
                  const feedGenerator =
                    dataLayer.selectors.getFeedGenerator(feedUri);
                  return html`<div class="feed-container">
                    ${postFeedTemplate({
                      feed,
                      currentUser,
                      feedGenerator,
                      hiddenPostUris,
                      onLoadMore: () => loadFeed(),
                      postInteractionHandler,
                    })}
                  </div>`;
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    async function loadFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextFeedPage(feedUri, {
        reload,
        limit: FEED_PAGE_SIZE + 1,
      });
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      // Initial empty state
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
      // Load feed generator info
      dataLayer.declarative.ensureFeedGenerator(feedUri).then(() => {
        renderPage();
      });
      await loadFeed();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
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

export default new FeedDetailView();
