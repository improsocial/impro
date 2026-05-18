import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import "/js/components/infinite-scroll-container.js";

class SettingsBlockedAccountsView extends View {
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
      const blockedProfiles = dataLayer.selectors.getBlockedProfiles();
      const cursor = blockedProfiles?.cursor;
      const loadingPromise = dataLayer.requests.loadBlockedProfiles({ cursor });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    function errorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading blocked accounts</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const blockedProfiles = dataLayer.selectors.getBlockedProfiles();
      const status = dataLayer.requests.getStatus("loadBlockedProfiles");
      const hasMore = blockedProfiles?.cursor ? true : false;

      render(
        html`<div id="settings-blocked-accounts-view">
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
                title: "Blocked accounts",
                onClickBackButton: () => window.router.go("/settings"),
              })}
              <main>
                <p
                  class="blocked-account-description"
                  data-testid="page-description"
                >
                  Blocked accounts cannot reply to your posts, mention you, or
                  interact with you. You won't see their content.
                </p>
                ${(() => {
                  if (status.error) {
                    return errorTemplate({ error: status.error });
                  }
                  return profileFeedTemplate({
                    profiles: blockedProfiles?.blocks ?? null,
                    hasMore,
                    onLoadMore: loadMore,
                    emptyMessage: "You haven't blocked any accounts.",
                  });
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

export default new SettingsBlockedAccountsView();
