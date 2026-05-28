import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
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
    await auth.requireAuth();

    async function loadMore() {
      const mutedProfiles = dataLayer.dataStore.$mutedProfiles.get();
      const cursor = mutedProfiles?.cursor;
      await dataLayer.requests.loadMutedProfiles({ cursor });
    }

    function errorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading muted accounts</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.signals.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const mutedProfiles = dataLayer.dataStore.$mutedProfiles.get();
      const status = dataLayer.requests.statusStore.$statuses
        .get("loadMutedProfiles")
        .get();
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
                  }
                  return profileFeedTemplate({
                    profiles: mutedProfiles?.mutes ?? null,
                    hasMore,
                    onLoadMore: loadMore,
                    emptyMessage: "You have not muted any accounts yet.",
                  });
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await loadMore();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsMutedAccountsView();
