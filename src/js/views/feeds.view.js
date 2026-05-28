import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";

class FeedsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await auth.requireAuth();

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const pinnedFeedGenerators =
        dataLayer.derived.$hydratedPinnedFeedGenerators.get();

      render(
        html`<div id="feeds-view">
          ${mainLayoutTemplate({
            currentUser,
            activeNavItem: "feeds",
            numNotifications,
            numChatNotifications,
            pluginService,
            onClickActiveNavItem: () => {
              window.scrollTo(0, 0);
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              ${headerTemplate({
                title: "Feeds",
                subtitle: "",
              })}
              <div class="feeds-list-header">Pinned Feeds</div>
              <div class="feeds-list">
                ${pinnedFeedGenerators
                  ? pinnedFeedGenerators.map((feedGenerator) =>
                      feedGenerator.uri === "following"
                        ? html`
                            <div class="feeds-list-item">
                              <div class="feeds-list-item-avatar">
                                <img
                                  src="/img/list-avatar-fallback.svg"
                                  alt=${feedGenerator.displayName}
                                  class="feed-avatar"
                                />
                              </div>
                              <div class="feeds-list-item-content">
                                <div class="feeds-list-item-title">
                                  ${feedGenerator.displayName}
                                </div>
                              </div>
                            </div>
                          `
                        : feedGeneratorListItemTemplate({ feedGenerator }),
                    )
                  : html`<div class="loading-spinner"></div>`}
              </div>
            `,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await dataLayer.declarative.ensurePinnedFeedGenerators();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new FeedsView();
