import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { auth } from "/js/auth.js";
import "/js/components/infinite-scroll-container.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
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
      isAuthenticated,
      pluginService,
      interactionHandlers,
    },
  }) {
    await auth.requireAuth();

    const { handleOrDid, rkey } = params;

    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
    }
    const feedUri = `at://${profileDid}/app.bsky.feed.generator/${rkey}`;

    const { postInteractionHandler, feedInteractionHandler } =
      interactionHandlers;

    bindPageTitle(root, () => {
      return (
        dataLayer.derived.$feedGenerators.get(feedUri)?.displayName ?? null
      );
    });

    pageEffect(root, () => {
      const showLessInteractions =
        dataLayer.derived.$showLessInteractions.get(feedUri);
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const currentUser = dataLayer.derived.$currentUser.get();
      const feedGenerator = dataLayer.derived.$feedGenerators.get(feedUri);
      const feedName = feedGenerator?.displayName || "";
      const feedAuthor = feedGenerator?.creator;
      const feedAuthorHandle = feedAuthor?.handle;
      const preferences = dataLayer.derived.$preferences.get();
      const isPinned = preferences?.isFeedPinned(feedUri) ?? false;
      const feed = dataLayer.derived.$hydratedFeeds.get(feedUri);
      render(
        html`<div id="feed-detail-view">
          ${headerTemplate({
            title: feedName,
            subtitle: feedAuthorHandle ? `@${feedAuthorHandle}` : "",
            rightItemTemplate: () => {
              const feedLink = `https://bsky.app/profile/${feedAuthorHandle || handleOrDid}/feed/${rkey}`;
              return html`<button
                  class="context-menu-button"
                  @click=${function (e) {
                    const contextMenu = this.nextElementSibling;
                    contextMenu.open(e.clientX, e.clientY);
                  }}
                >
                  <span>...</span>
                </button>
                <context-menu>
                  <context-menu-item-group>
                    <context-menu-item
                      data-testid="menu-action-feed-open-in-bsky"
                      icon="open-line"
                      @click=${() => {
                        window.open(feedLink, "_blank");
                      }}
                    >
                      Open in bsky.app
                    </context-menu-item>
                    <context-menu-item
                      data-testid="menu-action-feed-copy-link"
                      icon="link-line"
                      @click=${() => {
                        navigator.clipboard.writeText(feedLink);
                        showToast("Link copied to clipboard", {
                          style: "success",
                        });
                      }}
                    >
                      Copy link to feed
                    </context-menu-item>
                  </context-menu-item-group>
                </context-menu>
                <button
                  class=${classnames("pin-feed-button", {
                    pinned: isPinned,
                  })}
                  @click=${() =>
                    feedInteractionHandler.handlePinFeed(feedUri, !isPinned)}
                >
                  ${pinIconTemplate({ filled: isPinned })}
                </button>`;
            },
          })}
          <main>
            <div class="feed-container">
              ${postFeedTemplate({
                feed,
                currentUser,
                isAuthenticated,
                feedGenerator,
                hiddenPostUris,
                onLoadMore: () => loadFeed(),
                postInteractionHandler,
                pluginService,
                showEndMessage: true,
              })}
            </div>
          </main>
        </div>`,
        root,
      );
    });

    async function loadFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextFeedPage(
        { type: "feed", uri: feedUri },
        { reload, limit: FEED_PAGE_SIZE + 1 },
      );
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureFeedGenerator(feedUri);
      await loadFeed();
    });

    root.addEventListener("page-restore", async (e) => {
      if (e.detail?.isBack) return;
      await loadFeed({ reload: true });
    });
  }
}

export default new FeedDetailView();
