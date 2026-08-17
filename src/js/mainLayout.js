import { html, render } from "/js/lib/lit-html.js";
import { effect } from "/js/signals.js";
import { linkToLogin } from "/js/navigation.js";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { footerTemplate } from "/js/templates/footer.template.js";
import { eyeIconTemplate } from "/js/templates/icons/eyeIcon.template.js";
import { PLUGIN_PREVIEW_QUERY_PARAM } from "/js/plugins/pluginService.js";

function exitPluginPreview() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PLUGIN_PREVIEW_QUERY_PARAM);
  window.location.assign(url.toString());
}

function pluginPreviewBannerTemplate({ plugins }) {
  if (plugins.length === 0) return null;
  const links = [];
  plugins.forEach((plugin, index) => {
    if (index > 0) links.push(", ");
    links.push(
      html`<a
        class="plugin-preview-banner-link"
        href="/plugins/community/${encodeURIComponent(plugin.id)}"
        >${plugin.name}</a
      >`,
    );
  });
  return html`
    <div class="plugin-preview-banner" data-testid="plugin-preview-banner">
      <div class="plugin-preview-banner-icon">${eyeIconTemplate()}</div>
      <div class="plugin-preview-banner-body">
        <div class="plugin-preview-banner-title">Preview mode</div>
        <div class="plugin-preview-banner-subtitle">
          You are currently previewing community
          ${links.length === 1 ? "plugin" : "plugins"}: ${links}.
          <a class="plugin-preview-banner-link" href=${linkToLogin()}
            >Sign in</a
          >
          to install.
        </div>
      </div>
      <!-- <button
        class="plugin-preview-banner-exit"
        data-testid="plugin-preview-banner-exit"
        @click=${exitPluginPreview}
      >
        Exit preview
      </button> -->
    </div>
  `;
}
import { Layout } from "/js/router.js";
import "/js/components/animated-sidebar.js";
import "/js/components/trending-pane.js";
import "/js/components/sidebar-search.js";
import "/js/components/pinned-feeds-pane.js";

export function mainLayoutTemplate({
  isAuthenticated = true,
  currentUser,
  activeNavItem,
  isNavItemPage = false,
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveNavItem,
  children,
  onClickComposeButton,
  pluginService,
  previewingPlugins = [],
  onLongPressProfile = null,
  groupChatLinkService,
  dataLayer,
}) {
  return html`
    <div
      class="main-layout-wrapper"
      @chat-join-link:click=${(e) =>
        groupChatLinkService.handleAction(
          e.detail.actionType,
          e.detail.preview,
        )}
    >
      <div class="view-columns">
        <div class="view-column-left">
          ${sidebarTemplate({
            isAuthenticated,
            currentUser,
            activeNavItem,
            isNavItemPage,
            numNotifications,
            numChatNotifications,
            onClickActiveItem: onClickActiveNavItem,
            onClickComposeButton,
            pluginSidebarItems: pluginService.getSidebarItems(),
            onLongPressProfile,
          })}
        </div>
        <div class="view-column-center" data-testid="view-column-center">
          ${children}
        </div>
        <div class="view-column-right">
          ${activeNavItem === "search"
            ? ""
            : html`<sidebar-search
                .dataLayer=${dataLayer}
                .isAuthenticated=${isAuthenticated}
              ></sidebar-search>`}
          ${isAuthenticated
            ? html`<pinned-feeds-pane
                .dataLayer=${dataLayer}
                ?show-selected=${activeNavItem === "home"}
                ?more-feeds-active=${activeNavItem === "feeds"}
              ></pinned-feeds-pane>`
            : ""}
          <trending-pane .dataLayer=${dataLayer}></trending-pane>
        </div>
      </div>
      ${pluginPreviewBannerTemplate({ plugins: previewingPlugins })}
      ${footerTemplate({
        isAuthenticated,
        currentUser,
        activeNavItem,
        isNavItemPage,
        numNotifications,
        numChatNotifications,
        onClickActiveItem: onClickActiveNavItem,
        onLongPressProfile,
      })}
    </div>
  `;
}

export class MainLayout extends Layout {
  #container = null;
  #disposeEffect = null;

  constructor(context, router) {
    super();
    this.context = context;
    this.router = router;
    const pagesEl = document.createElement("div");
    pagesEl.id = "pages";
    this.slot = pagesEl;
  }

  mount(container) {
    if (this.#container) {
      throw new Error("MainLayout is already mounted");
    }
    const {
      isAuthenticated,
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      accountSwitcherService,
      pluginService,
      groupChatLinkService,
      profileHoverCardService,
      auth,
    } = this.context;
    const { router, slot } = this;

    container.id = "main-layout";
    this.#container = container;

    profileHoverCardService?.install(container);

    const onLongPressProfile =
      accountSwitcherService && auth.supportsMultipleAccounts()
        ? () => accountSwitcherService.openAccountSwitcherDialog()
        : null;

    // The active page may claim the click by cancelling the event
    const onClickActiveNavItem = () => {
      const event = new CustomEvent("active-nav-click", { cancelable: true });
      this.dispatchEvent(event);
      if (!event.defaultPrevented) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
    };

    this.#disposeEffect = effect(() => {
      const currentRoute = router.$currentRoute.get();
      const layoutOptions = currentRoute?.options?.layoutOptions ?? {};
      const currentUser = dataLayer.derived.$currentUser.get();
      const activeNavItem =
        typeof layoutOptions.activeNavItem === "function"
          ? layoutOptions.activeNavItem(currentRoute.params)
          : (layoutOptions.activeNavItem ?? null);
      // True when this route is the nav item's own page, rather than somewhere
      // deeper in its section
      const isNavItemPage =
        typeof layoutOptions.isNavItemPage === "function"
          ? layoutOptions.isNavItemPage(currentRoute.params)
          : (layoutOptions.isNavItemPage ?? false);
      const previewingPlugins = pluginService.getPreviewPlugins();
      render(
        mainLayoutTemplate({
          isAuthenticated,
          currentUser,
          activeNavItem,
          isNavItemPage,
          numNotifications:
            notificationService?.$numNotifications.get() ?? null,
          numChatNotifications:
            chatNotificationService?.$numNotifications.get() ?? null,
          onClickActiveNavItem,
          children: slot,
          onClickComposeButton: () =>
            postComposerService.composePost({ currentUser }),
          pluginService,
          previewingPlugins,
          onLongPressProfile,
          groupChatLinkService,
          dataLayer,
        }),
        container,
      );
    });
  }

  openSidebar() {
    this.#container?.querySelector("animated-sidebar")?.open();
  }

  dispose() {
    this.context.profileHoverCardService?.dispose();
    this.#disposeEffect?.();
    this.#disposeEffect = null;
    this.#container?.replaceChildren();
    this.#container = null;
  }
}
