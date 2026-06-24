import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";
import { feedGeneratorListItemSkeletonTemplate } from "/js/templates/feedGeneratorListItemSkeleton.template.js";
import { linkToList } from "/js/navigation.js";
import "/js/components/container-link.js";

class FeedsView extends View {
  async render({ root, context: { dataLayer, mainLayout } }) {
    await auth.requireAuth();

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get();

      render(
        html`<div id="feeds-view">
          ${mainLayout({
            activeNavItem: "feeds",
            onClickActiveNavItem: () => {
              window.scrollTo(0, 0);
            },
            children: html`
              ${headerTemplate({
                title: "Feeds",
                subtitle: "",
              })}
              <div class="feeds-list-header">Pinned Feeds</div>
              <div class="feeds-list">
                ${pinnedItems
                  ? pinnedItems.map((item) => {
                      if (item.type === "following") {
                        return html`
                          <div class="feeds-list-item">
                            <div class="feeds-list-item-avatar">
                              <img
                                src="/img/list-avatar-fallback.svg"
                                alt=${item.data.displayName}
                                class="feed-avatar"
                              />
                            </div>
                            <div class="feeds-list-item-content">
                              <div class="feeds-list-item-title">
                                ${item.data.displayName}
                              </div>
                              <div class="feeds-list-item-creator">
                                Feed by @bsky.app
                              </div>
                            </div>
                          </div>
                        `;
                      }
                      if (item.type === "list") {
                        return html`
                          <container-link
                            class="feeds-list-item clickable"
                            data-testid="feeds-list-item-list"
                            href=${linkToList(item.data)}
                          >
                            <div class="feeds-list-item-avatar">
                              ${item.data.avatar
                                ? html`<img
                                    src=${item.data.avatar}
                                    alt=${item.data.name}
                                    class="feed-avatar"
                                  />`
                                : html`<img
                                    src="/img/list-avatar-fallback.svg"
                                    alt=${item.data.name}
                                    class="feed-avatar"
                                  />`}
                            </div>
                            <div class="feeds-list-item-content">
                              <div class="feeds-list-item-title">
                                ${item.data.name}
                              </div>
                              ${item.data.creator
                                ? html`<div class="feeds-list-item-creator">
                                    List by
                                    ${item.data.creator.did === currentUser?.did
                                      ? "you"
                                      : `@${item.data.creator.handle}`}
                                  </div>`
                                : ""}
                            </div>
                          </container-link>
                        `;
                      }
                      return feedGeneratorListItemTemplate({
                        feedGenerator: item.data,
                        currentUserDid: currentUser?.did,
                      });
                    })
                  : Array.from({ length: 5 }).map(() =>
                      feedGeneratorListItemSkeletonTemplate(),
                    )}
              </div>
            `,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await dataLayer.declarative.ensurePinnedItems();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new FeedsView();
