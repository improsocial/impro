import homeView from "/js/views/home.view.js";
import postThreadView from "/js/views/postThread.view.js";
import postLikesView from "/js/views/postLikes.view.js";
import postQuotesView from "/js/views/postQuotes.view.js";
import postRepostsView from "/js/views/postReposts.view.js";
import loginView from "/js/views/login.view.js";
import notificationsView from "/js/views/notifications.view.js";
import chatView from "/js/views/chat.view.js";
import chatRequestsView from "/js/views/chatRequests.view.js";
import chatDetailView from "/js/views/chatDetail.view.js";
import groupChatDetailsView from "/js/views/groupChatDetails.view.js";
import feedsView from "/js/views/feeds.view.js";
import listsView from "/js/views/lists.view.js";
import profileView from "/js/views/profile.view.js";
import profileFollowersView from "/js/views/profileFollowers.view.js";
import profileFollowingView from "/js/views/profileFollowing.view.js";
import profileKnownFollowersView from "/js/views/profileKnownFollowers.view.js";
import searchView from "/js/views/search.view.js";
import hashtagView from "/js/views/hashtag.view.js";
import notFoundView from "/js/views/notFound.view.js";
import settingsView from "/js/views/settings.view.js";
import settingsAppearanceView from "/js/views/settings/appearance.view.js";
import settingsMutedWordsView from "/js/views/settings/mutedWords.view.js";
import settingsBlockedAccountsView from "/js/views/settings/blockedAccounts.view.js";
import settingsMutedAccountsView from "/js/views/settings/mutedAccounts.view.js";
import settingsAdvancedView from "/js/views/settings/advanced.view.js";
import settingsNotificationsView from "/js/views/settings/notifications.view.js";
import installedPluginsView from "/js/views/installedPlugins.view.js";
import pluginSettingsView from "/js/views/pluginSettings.view.js";
import pluginPageView from "/js/views/pluginPage.view.js";
import communityPluginsView from "/js/views/communityPlugins.view.js";
import communityPluginListingView from "/js/views/communityPluginListing.view.js";
import feedDetailView from "/js/views/feedDetail.view.js";
import listDetailView from "/js/views/listDetail.view.js";
import bookmarksView from "/js/views/bookmarks.view.js";
import { DataLayer } from "/js/dataLayer/dataLayer.js";
import { DraftMediaStore } from "/js/drafts.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { IdentityResolver } from "/js/atproto.js";
import { Router } from "/js/router.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { Api } from "/js/api.js";
import { auth } from "/js/auth.js";
import { NotificationService } from "/js/notificationService.js";
import { ChatNotificationService } from "/js/chatNotificationService.js";
import { SystemNotificationService } from "/js/systemNotificationService.js";
import { PostComposerService } from "/js/postComposerService.js";
import { AccountSwitcherService } from "/js/accountSwitcherService.js";
import { ReportService } from "/js/reportService.js";
import { GroupChatLinkService } from "/js/groupChatLinkService.js";
import { ProfileHoverCardService } from "/js/profileHoverCardService.js";
import { InteractionHandlers } from "/js/interactionHandlers.js";
import { hapticsImpactLight } from "/js/haptics.js";
import { isNative, wait } from "/js/utils.js";
import { effect, untrack } from "/js/signals.js";
import { dispatchNativeRefreshEnded } from "/js/nativeRefresh.js";
import { NOTIFICATIONS_PAGE_SIZE, IN_APP_LINK_DOMAINS } from "/js/config.js";
import { setUpIdentityPrecaching } from "/js/identityPrecaching.js";
import {
  getAppViewConfig,
  handleAppViewResetQueryParam,
} from "/js/appViewConfig.js";
import { PluginService } from "/js/plugins/pluginService.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { Constellation } from "/js/constellation.js";
import { MainLayout } from "/js/mainLayout.js";

async function checkDraftsEnabled() {
  const results = await Promise.all(
    [
      "rpc:app.bsky.draft.getDrafts",
      "rpc:app.bsky.draft.createDraft",
      "rpc:app.bsky.draft.updateDraft",
      "rpc:app.bsky.draft.deleteDraft",
    ].map((scope) => auth.hasScope(scope)),
  );
  return results.every(Boolean);
}

export async function main() {
  // Body class for styling
  if (isNative()) {
    document.body.classList.add("native");
  }

  handleAppViewResetQueryParam();

  await auth.handleForceLogoutParam();
  await auth.ensureCurrentScopes();

  const session = await auth.getSession();
  const appViewConfig = getAppViewConfig();
  const api = new Api(session ?? null, {
    bskyAppViewServiceDid: appViewConfig.appViewServiceDid,
    chatAppViewServiceDid: appViewConfig.chatServiceDid,
  });
  const preferencesProvider = new PreferencesProvider(api);
  const identityResolver = new IdentityResolver();
  const draftMediaStore = new DraftMediaStore();
  const hiddenFeedItemsStore = new HiddenFeedItemsStore();
  const constellation = new Constellation();
  const dataLayer = new DataLayer(
    api,
    preferencesProvider,
    identityResolver,
    draftMediaStore,
    hiddenFeedItemsStore,
    constellation,
  );
  const router = new Router();
  const pluginService = new PluginService(
    preferencesProvider,
    session,
    dataLayer,
    hiddenFeedItemsStore,
    router,
    constellation,
  );
  // put dataLayer on window for easy access in dev tools
  window.dataLayer = dataLayer;
  const notificationService = session ? new NotificationService(api) : null;
  const chatNotificationService = session
    ? new ChatNotificationService(api)
    : null;
  const systemNotificationService =
    notificationService && chatNotificationService
      ? new SystemNotificationService(
          notificationService,
          chatNotificationService,
          router,
        )
      : null;
  const postComposerService = session
    ? new PostComposerService(dataLayer, identityResolver, pluginService, {
        draftsEnabled: await checkDraftsEnabled(),
      })
    : null;
  const accountSwitcherService = session
    ? new AccountSwitcherService(dataLayer)
    : null;
  const reportService = session ? new ReportService(dataLayer) : null;
  const groupChatLinkService = new GroupChatLinkService(dataLayer, router);
  const interactionHandlers = new InteractionHandlers({
    session,
    dataLayer,
    postComposerService,
    reportService,
  });
  const profileHoverCardService = new ProfileHoverCardService(
    dataLayer,
    interactionHandlers,
  );
  pluginService.setRenderContext({
    isAuthenticated: !!session,
    dataLayer,
    pluginService,
    postInteractionHandler: interactionHandlers.postInteractionHandler,
  });

  // Precache author DIDs when data is set in the data store.
  // This will save us from needing to resolve handles when navigating between pages.
  setUpIdentityPrecaching(dataLayer, identityResolver);

  // Preload the current user for layout
  if (session) {
    dataLayer.declarative.ensureCurrentUser().catch((error) => {
      console.warn("Error preloading current user:", error);
    });
  }

  // Preload preferences - sometimes this fails, so try it twice.
  try {
    await dataLayer.initializePreferences();
  } catch (error) {
    console.error("Error initializing preferences:", error);
    await wait(1000);
    try {
      await dataLayer.initializePreferences();
    } catch (retryError) {
      console.error("Error initializing preferences:", retryError);
      throw retryError;
    }
  }

  try {
    await pluginService.loadEnabledPlugins();
  } catch (error) {
    console.error("Error loading plugins", error);
  }

  if (notificationService) {
    notificationService.startPolling();
  }

  if (chatNotificationService) {
    chatNotificationService.startPolling();
  }

  if (systemNotificationService) {
    systemNotificationService.start();
  }

  const context = {
    isAuthenticated: !!session,
    api,
    dataLayer,
    identityResolver,
    notificationService,
    chatNotificationService,
    systemNotificationService,
    postComposerService,
    accountSwitcherService,
    reportService,
    groupChatLinkService,
    pluginService,
    interactionHandlers,
    profileHoverCardService,
  };

  const isOwnProfile = (params) => {
    const currentUser = dataLayer.derived.$currentUser.get();
    if (!currentUser) return false;
    return (
      params.handleOrDid == null ||
      params.handleOrDid === currentUser.did ||
      params.handleOrDid === currentUser.handle
    );
  };

  scrollLocks.setContainerProvider(() => router.currentPage);

  if (notificationService) {
    effect(() => {
      const numNotifications = notificationService.$numNotifications.get() ?? 0;
      if (numNotifications === 0 || router.currentPath === "/notifications")
        return;
      // When the notifications page is untouched (scrolled to top or not yet
      // visited), preload new notifications.
      if (router.getScrollYForPath("/notifications") > 0) return;
      const { loading: notificationsLoading } = untrack(() =>
        dataLayer.requests.statusStore.$statuses.get("loadNotifications"),
      );
      if (notificationsLoading) return;
      dataLayer.requests.loadNotifications({
        limit: NOTIFICATIONS_PAGE_SIZE,
        reload: true,
      });
    });
  }

  router.addRoute(["/", "/intent/compose"], () => homeView, {
    layoutOptions: { activeNavItem: "home", isNavItemPage: true },
    scrollRestore: "always",
  });
  router.addRoute("/login", () => loginView, { layout: false });
  router.addRoute("/notifications", () => notificationsView, {
    layoutOptions: { activeNavItem: "notifications", isNavItemPage: true },
    scrollRestore: "always",
  });
  router.addRoute("/messages/inbox", () => chatRequestsView, {
    layoutOptions: { activeNavItem: "chat" },
  });
  router.addRoute("/messages/:convoId/settings", () => groupChatDetailsView, {
    layoutOptions: { activeNavItem: "chat" },
  });
  router.addRoute("/messages/:convoId", () => chatDetailView, {
    layoutOptions: { activeNavItem: "chat" },
    scrollRestore: "manual",
  });
  router.addRoute("/messages", () => chatView, {
    layoutOptions: { activeNavItem: "chat", isNavItemPage: true },
  });
  router.addRoute("/feeds", () => feedsView, {
    layoutOptions: { activeNavItem: "feeds", isNavItemPage: true },
  });
  router.addRoute("/lists", () => listsView, {
    layoutOptions: { activeNavItem: "lists", isNavItemPage: true },
  });
  router.addRoute("/bookmarks", () => bookmarksView, {
    layoutOptions: { activeNavItem: "bookmarks", isNavItemPage: true },
  });
  router.addRoute("/search", () => searchView, {
    layoutOptions: { activeNavItem: "search", isNavItemPage: true },
    scrollRestore: "always",
  });
  router.addRoute("/hashtag/:tag", () => hashtagView);
  router.addRoute("/profile/:handleOrDid/feed/:rkey", () => feedDetailView);
  router.addRoute("/profile/:handleOrDid/lists/:rkey", () => listDetailView);
  router.addRoute(
    "/profile/:handleOrDid/post/:rkey/likes",
    () => postLikesView,
  );
  router.addRoute(
    "/profile/:handleOrDid/post/:rkey/quotes",
    () => postQuotesView,
  );
  router.addRoute(
    "/profile/:handleOrDid/post/:rkey/reposts",
    () => postRepostsView,
  );
  router.addRoute("/profile/:handleOrDid/post/:rkey", () => postThreadView, {
    scrollRestore: "manual",
  });
  router.addRoute(
    "/profile/:handleOrDid/known-followers",
    () => profileKnownFollowersView,
  );
  router.addRoute(
    "/profile/:handleOrDid/followers",
    () => profileFollowersView,
  );
  router.addRoute(
    "/profile/:handleOrDid/following",
    () => profileFollowingView,
  );
  // "/profile" with no param is the current user's profile
  router.addRoute(["/profile/:handleOrDid", "/profile"], () => profileView, {
    layoutOptions: {
      activeNavItem: (params) => (isOwnProfile(params) ? "profile" : null),
      isNavItemPage: (params) => isOwnProfile(params),
    },
  });
  const settingsRouteOptions = {
    layoutOptions: { activeNavItem: "settings" },
  };
  router.addRoute("/settings", () => settingsView, {
    layoutOptions: { activeNavItem: "settings", isNavItemPage: true },
  });
  router.addRoute(
    "/settings/appearance",
    () => settingsAppearanceView,
    settingsRouteOptions,
  );
  router.addRoute(
    "/settings/notifications",
    () => settingsNotificationsView,
    settingsRouteOptions,
  );
  router.addRoute(
    "/settings/muted-words",
    () => settingsMutedWordsView,
    settingsRouteOptions,
  );
  router.addRoute(
    "/settings/muted-accounts",
    () => settingsMutedAccountsView,
    settingsRouteOptions,
  );
  router.addRoute(
    "/settings/blocked-accounts",
    () => settingsBlockedAccountsView,
    settingsRouteOptions,
  );
  router.addRoute(
    "/settings/advanced",
    () => settingsAdvancedView,
    settingsRouteOptions,
  );
  const pluginsRouteOptions = {
    layoutOptions: { activeNavItem: "plugins" },
  };
  router.addRoute("/plugins/installed", () => installedPluginsView, {
    layoutOptions: { activeNavItem: "plugins", isNavItemPage: !!session },
  });
  router.addRoute(
    "/plugin/:pluginId/settings",
    () => pluginSettingsView,
    pluginsRouteOptions,
  );
  router.addRoute(
    "/plugin/:pluginId/pages/:pageId",
    () => pluginPageView,
    pluginsRouteOptions,
  );
  router.addRoute("/plugins/community", () => communityPluginsView, {
    // Logged out, the Plugins nav item points here instead
    layoutOptions: { activeNavItem: "plugins", isNavItemPage: !session },
  });
  router.addRoute(
    "/plugins/community/:pluginId",
    () => communityPluginListingView,
    pluginsRouteOptions,
  );
  router.addRedirects({
    // Old community plugin URLs
    "/settings/plugins/community": () => "/plugins/community",
    "/settings/plugins/community/:pluginId": (params) =>
      `/plugins/community/${encodeURIComponent(params.pluginId)}`,
    // Old installed plugin URLs
    "/settings/plugins": () => "/plugins/installed",
    "/settings/plugins/:pluginId": (params) =>
      `/plugin/${encodeURIComponent(params.pluginId)}/settings`,
  });
  router.setNotFoundView(() => notFoundView);

  router.renderRoute(({ view, params, container, layout }) => {
    return view({
      root: container,
      layout,
      router,
      params,
      context,
    });
  });

  router.on("navigate", () => {
    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      const wrapper = dialog.closest("[data-dialog-wrapper]");
      if (wrapper && typeof wrapper.close === "function") {
        wrapper.close();
      } else {
        closeWithAnimation(dialog);
      }
    });
  });

  const mainLayout = new MainLayout(context, router);
  router.setLayout(mainLayout);

  router.mount(document.getElementById("app-root"));

  // attach to window since it's used in some nested functions
  window.router = router;

  // intercept in-app links
  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (!anchor || anchor.dataset.external) {
      return;
    }
    // Don't intercept if e.preventDefault() was already called
    if (e.defaultPrevented) {
      return;
    }
    // Let the browser handle alt-click (download)
    if (e.altKey) {
      return;
    }
    if (anchor.href.startsWith("/")) {
      e.preventDefault();
      return router.go(anchor.href);
    }
    const parsedUrl = new URL(anchor.href);
    const currentHostname = window.location.hostname;
    // Handle direct .bsky.social links
    if (parsedUrl.hostname.endsWith(".bsky.social")) {
      const handle = parsedUrl.hostname;
      e.preventDefault();
      return router.go(`/profile/${handle}`);
    }
    if (
      currentHostname === parsedUrl.hostname ||
      IN_APP_LINK_DOMAINS.includes(parsedUrl.hostname)
    ) {
      const relativePath = parsedUrl.pathname;
      // Only intercept in-app links if there's a match in the router
      if (
        router.hasRoute(relativePath) &&
        !relativePath.startsWith("/messages/settings")
      ) {
        e.preventDefault();
        router.go(parsedUrl.pathname + parsedUrl.search + parsedUrl.hash);
      }
    }
  });

  await router.load(window.location.pathname ?? "/");

  // Sometimes clicks get swallowed after swipe-back navigations on iOS safari
  // Adding a global touchstart listener fixes this for some reason
  document.addEventListener("touchstart", () => {}, { passive: true });

  window.addEventListener("native-reload", () => {
    hapticsImpactLight();
    window.location.reload();
  });

  // Page has loaded, let the native app know
  dispatchNativeRefreshEnded();
}
