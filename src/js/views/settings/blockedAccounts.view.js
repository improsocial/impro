import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import "/js/components/infinite-scroll-container.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";

export default async function settingsBlockedAccountsView({
  root,
  router,
  layout,
  context: { auth, dataLayer, isAuthenticated, pluginService },
}) {
  await auth.requireAuth();

  async function loadBlockedAccounts({ reload = false } = {}) {
    const cursor = reload
      ? undefined
      : dataLayer.derived.$blockedProfiles.get()?.cursor;
    await dataLayer.requests.loadBlockedProfiles({ cursor });
  }

  function loadPageData() {
    loadBlockedAccounts({ reload: true });
  }

  function errorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading blocked accounts</div>
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  bindPageTitle(root, () => "Blocked accounts");

  pageEffect(root, () => {
    const blockedProfiles = dataLayer.derived.$blockedProfiles.get();
    const status = dataLayer.requests.statusStore.$statuses.get(
      "loadBlockedProfiles",
    );
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
            if (status.error) {
              return errorTemplate({ error: status.error });
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
