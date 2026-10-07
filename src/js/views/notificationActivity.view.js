import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
import { isEmptyPost } from "/js/dataHelpers.js";
import { Signal, ReactiveStore } from "/js/signals.js";

function activityErrorTemplate({ onRetry }) {
  return html`<div class="error-state" data-testid="activity-error">
    <div>Error loading posts</div>
    ${tryAgainButtonTemplate({ onClick: onRetry })}
  </div>`;
}

export default async function notificationActivityView({
  root,
  context: {
    auth,
    dataLayer,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  await auth.requireAuth();

  const { postInteractionHandler } = interactionHandlers;

  const postUris = (
    new URLSearchParams(window.location.search).get("posts") ?? ""
  )
    .split(",")
    .filter((uri) => uri !== "");

  const state = new ReactiveStore("notificationActivityView");
  state.$error = new Signal.State(null);
  state.$hasLoaded = new Signal.State(false);

  bindPageTitle(root, () => "Notifications");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const posts = postUris.map((uri) =>
      dataLayer.derived.$hydratedPosts.get(uri),
    );
    const error = state.$error.get();
    const isCached = posts.every((post) => !!post);

    const feed =
      postUris.length === 0 || isCached || state.$hasLoaded.get()
        ? {
            feed: posts
              .filter((post) => post && !isEmptyPost(post))
              .map((post) => ({ post })),
            cursor: null,
          }
        : null;

    render(
      html`<div id="notification-activity-view">
        ${headerTemplate({ title: "Notifications" })}
        <main>
          ${error && !isCached
            ? activityErrorTemplate({ onRetry: loadPageData })
            : postFeedTemplate({
                feed,
                currentUser,
                isAuthenticated,
                postInteractionHandler,
                emptyMessage: "No posts here",
                pluginService,
              })}
        </main>
      </div>`,
      root,
    );
  });

  async function loadPageData() {
    if (postUris.length === 0) return;
    state.$error.set(null);
    try {
      await dataLayer.requests.loadPosts(postUris);
      state.$hasLoaded.set(true);
    } catch (error) {
      console.error(error);
      state.$error.set(error);
    }
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
