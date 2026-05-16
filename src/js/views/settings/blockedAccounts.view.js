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

    function listTemplate({ blocks, hasMore }) {
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadMore();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list" data-testid="blocked-account-list">
          ${blocks.map((profile) =>
            profileListItemTemplate({ actor: profile }),
          )}
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

      let body;
      if (status.error) {
        body = errorTemplate({ error: status.error });
      } else if (!blockedProfiles) {
        body = skeletonTemplate();
      } else if (blockedProfiles.blocks.length === 0) {
        body = html`<div
          class="blocked-account-empty"
          data-testid="blocked-account-empty"
        >
          You haven't blocked any accounts.
        </div>`;
      } else {
        body = listTemplate({ blocks: blockedProfiles.blocks, hasMore });
      }

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
                <p class="blocked-account-description">
                  Blocked accounts cannot reply to your posts, mention you, or
                  interact with you. You won't see their content.
                </p>
                ${body}
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
