import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { linkToFeed } from "/js/navigation.js";

class FeedsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
    },
  }) {
    await requireAuth();

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const pinnedFeedGenerators =
        dataLayer.selectors.getPinnedFeedGenerators();

      render(
        html`<div id="feeds-view">
          ${mainLayoutTemplate({
            currentUser,
            activeNavItem: "feeds",
            numNotifications,
            numChatNotifications,
            onClickActiveNavItem: () => {
              window.scrollTo(0, 0);
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              ${textHeaderTemplate({
                title: "Feeds",
                subtitle: "",
              })}
              <div class="feeds-list-header">Pinned Feeds</div>
              <div class="feeds-list">
                ${pinnedFeedGenerators
                  ? pinnedFeedGenerators.map(
                      (feedGenerator) => html`
                        <div
                          class=${classnames("feeds-list-item", {
                            clickable: feedGenerator.uri !== "following",
                          })}
                          @click=${() => {
                            if (feedGenerator.uri !== "following") {
                              window.router.go(linkToFeed(feedGenerator));
                            }
                          }}
                        >
                          <div class="feeds-list-item-avatar">
                            ${feedGenerator.avatar
                              ? html`<img
                                  src=${feedGenerator.avatar}
                                  alt=${feedGenerator.displayName}
                                  class="feed-avatar"
                                />`
                              : html`<img
                                  src="/img/list-avatar-fallback.svg"
                                  alt=${feedGenerator.displayName}
                                  class="feed-avatar"
                                />`}
                          </div>
                          <div class="feeds-list-item-content">
                            <div class="feeds-list-item-title">
                              ${feedGenerator.displayName}
                            </div>
                            ${feedGenerator.creator
                              ? html`<div class="feeds-list-item-creator">
                                  by @${feedGenerator.creator.handle}
                                </div>`
                              : ""}
                          </div>
                        </div>
                      `
                    )
                  : html`<div class="loading-spinner"></div>`}
              </div>
            `,
          })}
        </div>`,
        root
      );
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarations.ensureCurrentUser().then(() => {
        renderPage();
      });
      await dataLayer.declarations.ensurePinnedFeedGenerators();
      renderPage();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
      renderPage();
    });

    notificationService?.on("update", () => renderPage());

    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new FeedsView();
