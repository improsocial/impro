import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import "/js/components/infinite-scroll-container.js";

export default async function settingsBlockedAccountsView({
  root,
  router,
  layout,
  context: { auth, dataLayer, isAuthenticated, pluginService },
}) {
  await auth.requireAuth();

  async function loadBlockedAccounts({ reload = false } = {}) {
    await dataLayer.requests.loadBlockedProfiles({}, { reload });
  }

  function loadPageData() {
    loadBlockedAccounts({ reload: true });
  }

  function errorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading blocked accounts</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }

  bindPageTitle(root, () => "Blocked accounts");

  pageEffect(root, () => {
    const blockedProfiles = dataLayer.derived.$blockedProfiles.get();
    const error = dataLayer.derived.$blockedProfilesError.get();
    const hasMore = blockedProfiles?.cursor ? true : false;

    render(
      html`<div id="settings-blocked-accounts-view">
        ${headerTemplate({
          title: "Blocked accounts",
          backButtonFallbackRoute: "/settings",
        })}
        <main>
          <p class="blocked-account-description" data-testid="page-description">
            Blocked accounts cannot reply to your posts, mention you, or
            interact with you. You won't see their content.
          </p>
          ${(() => {
            if (error) {
              return errorTemplate({ error });
            }
            return profileFeedTemplate({
              profiles: blockedProfiles?.blocks ?? null,
              hasMore,
              onLoadMore: loadBlockedAccounts,
              emptyMessage: "You haven't blocked any accounts.",
              isAuthenticated,
              pluginService,
            });
          })()}
        </main>
      </div>`,
      root,
    );
  });

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
