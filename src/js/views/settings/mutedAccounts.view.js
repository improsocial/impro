import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
} from "/js/templates/profileListItem.template.js";
import "/js/components/infinite-scroll-container.js";

class SettingsMutedAccountsView extends View {
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
    await requireAuth();

    async function loadMore() {
      const mutedProfiles = dataLayer.selectors.getMutedProfiles();
      const cursor = mutedProfiles?.cursor;
      const loadingPromise = dataLayer.requests.loadMutedProfiles({ cursor });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    function listTemplate({ mutes, hasMore }) {
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadMore();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list" data-testid="muted-account-list">
          ${mutes.map((profile) => profileListItemTemplate({ actor: profile }))}
        </div>
        ${hasMore
          ? Array.from({ length: 3 }).map(() =>
              profileListItemSkeletonTemplate(),
            )
          : ""}
      </infinite-scroll-container>`;
    }

    function skeletonTemplate() {
      return html`<div class="profile-list">
        ${Array.from({ length: 6 }).map(() =>
          profileListItemSkeletonTemplate(),
        )}
      </div>`;
    }

    function errorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading muted accounts</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const mutedProfiles = dataLayer.selectors.getMutedProfiles();
      const status = dataLayer.requests.getStatus("loadMutedProfiles");
      const hasMore = mutedProfiles?.cursor ? true : false;

      render(
        html`<div id="settings-muted-accounts-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${headerTemplate({
                title: "Muted accounts",
                onClickBackButton: () => window.router.go("/settings"),
              })}
              <main>
                <p
                  class="muted-account-description"
                  data-testid="page-description"
                >
                  Muted accounts have their posts removed from your feed and
                  from your notifications. Mutes are completely private.
                </p>
                ${(() => {
                  if (status.error) {
                    return errorTemplate({ error: status.error });
                  } else if (!mutedProfiles) {
                    return skeletonTemplate();
                  } else if (mutedProfiles.mutes.length === 0) {
                    return html`<div
                      class="empty-state-message"
                      data-testid="muted-account-empty"
                    >
                      You have not muted any accounts yet.
                    </div>`;
                  } else {
                    return listTemplate({
                      mutes: mutedProfiles.mutes,
                      hasMore,
                    });
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
      await loadMore();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
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

export default new SettingsMutedAccountsView();
