import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { MainLayout, mainLayoutTemplate } from "/js/mainLayout.js";
import { render, html } from "/js/lib/lit-html.js";
import { Signal, SignalSet } from "/js/signals.js";

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
  followersCount: 100,
  followsCount: 50,
};

function flushRender() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
}

describe("MainLayout", () => {
  let harness;

  function createHarness() {
    const $currentRoute = new Signal.State(null);
    const $currentUser = new Signal.State(mockUser);
    const $numNotifications = new Signal.State(0);
    const $numChatNotifications = new Signal.State(0);
    const sidebarItems = new SignalSet();
    const composePost = mock.fn();
    const context = {
      isAuthenticated: true,
      dataLayer: { derived: { $currentUser } },
      notificationService: { $numNotifications },
      chatNotificationService: { $numNotifications: $numChatNotifications },
      postComposerService: { composePost },
      accountSwitcherService: null,
      pluginService: { getSidebarItems: () => [...sidebarItems] },
      groupChatLinkService: { handleAction: mock.fn() },
      interactionHandlers: { postInteractionHandler: {} },
    };
    const layout = new MainLayout(context, { $currentRoute });
    const appRoot = document.createElement("div");
    const layoutContainer = document.createElement("div");
    appRoot.appendChild(layoutContainer);
    layout.mount(layoutContainer);
    return {
      layout,
      appRoot,
      layoutContainer,
      $currentRoute,
      $currentUser,
      $numNotifications,
      sidebarItems,
      composePost,
    };
  }

  function setRoute(options, params = {}) {
    harness.$currentRoute.set({ path: "/", route: "/", params, options });
  }

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.layout.dispose();
  });

  it("renders the chrome with the pages slot inside the center column", () => {
    const { layout, appRoot } = harness;
    const layoutRoot = appRoot.querySelector("#main-layout");
    assert(layoutRoot !== null);
    const centerColumn = appRoot.querySelector(
      "[data-testid='view-column-center']",
    );
    assert(centerColumn.contains(layout.slot));
    assert(appRoot.querySelector("animated-sidebar") !== null);
    assert(appRoot.querySelector("[data-testid='footer-nav']") !== null);
  });

  it("re-renders chrome on badge changes without touching cached pages", async () => {
    const { layout, appRoot, $numNotifications } = harness;
    const cachedPage = document.createElement("div");
    cachedPage.className = "page";
    layout.slot.appendChild(cachedPage);
    assert.deepEqual(
      appRoot.querySelectorAll("[data-testid='status-badge']").length,
      0,
    );

    $numNotifications.set(5);
    await flushRender();

    assert(appRoot.querySelectorAll("[data-testid='status-badge']").length > 0);
    assert(layout.slot.children[0] === cachedPage);
  });

  it("derives the active nav item from the current route options", async () => {
    setRoute({ layoutOptions: { activeNavItem: "home" } });
    await flushRender();

    const homeItem = harness.appRoot.querySelector(
      "[data-testid='footer-nav-home']",
    );
    assert(homeItem.classList.contains("active"));
  });

  it("supports function-valued activeNavItem receiving route params", async () => {
    setRoute(
      {
        layoutOptions: {
          activeNavItem: (params) =>
            params.handleOrDid === mockUser.did ? "profile" : null,
        },
      },
      { handleOrDid: mockUser.did },
    );
    await flushRender();
    const profileItem = harness.appRoot.querySelector(
      "[data-testid='footer-nav-profile']",
    );
    assert(profileItem.classList.contains("active"));

    setRoute(
      {
        layoutOptions: {
          activeNavItem: (params) =>
            params.handleOrDid === mockUser.did ? "profile" : null,
        },
      },
      { handleOrDid: "did:plc:someoneelse" },
    );
    await flushRender();
    assert(
      !harness.appRoot
        .querySelector("[data-testid='footer-nav-profile']")
        .classList.contains("active"),
    );
  });

  it("preserves router-set container classes across chrome re-renders", async () => {
    const { layoutContainer, $numNotifications } = harness;
    layoutContainer.classList.add("layout-hidden");

    $numNotifications.set(5);
    await flushRender();

    assert(layoutContainer.classList.contains("layout-hidden"));
  });

  it("throws when mounted a second time", () => {
    assert.throws(
      () => harness.layout.mount(document.createElement("div")),
      /already mounted/,
    );
  });

  it("clears its container on dispose and allows remounting", () => {
    harness.layout.dispose();
    assert.deepEqual(harness.layoutContainer.children.length, 0);

    const newContainer = document.createElement("div");
    harness.layout.mount(newContainer);
    assert(newContainer.querySelector("animated-sidebar") !== null);
  });

  it("opens the composer from the sidebar compose button", () => {
    const { appRoot, composePost } = harness;
    appRoot.querySelector("[data-testid='sidebar-compose-button']").click();
    assert.deepEqual(composePost.mock.callCount(), 1);
    assert.deepEqual(
      composePost.mock.calls[0].arguments[0].currentUser,
      mockUser,
    );
  });

  it("lets a layout listener claim active nav clicks via preventDefault", async (t) => {
    const scrollTo = t.mock.method(window, "scrollTo", () => {});
    const { layout, appRoot } = harness;
    setRoute({ layoutOptions: { activeNavItem: "home" } });
    await flushRender();
    const handler = mock.fn((event) => event.preventDefault());
    layout.addEventListener("active-nav-click", handler);

    appRoot.querySelector("[data-testid='footer-nav-home']").click();

    assert.deepEqual(handler.mock.callCount(), 1);
    assert.deepEqual(scrollTo.mock.callCount(), 0);
    layout.removeEventListener("active-nav-click", handler);
  });

  it("scrolls to top on active nav clicks nobody claims", async (t) => {
    const scrollTo = t.mock.method(window, "scrollTo", () => {});
    setRoute({ layoutOptions: { activeNavItem: "home" } });
    await flushRender();

    harness.appRoot.querySelector("[data-testid='footer-nav-home']").click();

    assert.deepEqual(scrollTo.mock.callCount(), 1);
    assert.deepEqual(scrollTo.mock.calls[0].arguments, [
      { top: -1, behavior: "smooth" },
    ]);
  });

  it("reflects plugin sidebar item registration reactively", async () => {
    const { appRoot, sidebarItems } = harness;
    assert.deepEqual(appRoot.querySelector(".sidebar-plugin-nav-item"), null);

    sidebarItems.add({ title: "My Plugin", icon: "star", invoke: () => {} });
    await flushRender();

    const pluginItem = appRoot.querySelector(".sidebar-plugin-nav-item");
    assert(pluginItem !== null);
    assert(pluginItem.textContent.includes("My Plugin"));
  });
});

const mockPluginService = {
  getSidebarItems: () => [],
};

describe("mainLayoutTemplate", () => {
  it("should render children in center column", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      children: html`<div class="test-content">Test Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    const centerColumn = container.querySelector(
      "[data-testid='view-column-center']",
    );
    assert(centerColumn.querySelector(".test-content") !== null);
  });
});

describe("mainLayoutTemplate - footer", () => {
  it("should render footer", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='footer-nav']") !== null);
  });

  it("should render logged out footer when not authenticated", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: false,
      currentUser: null,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='logged-out-footer']") !== null,
    );
  });
});

describe("mainLayoutTemplate - sidebar", () => {
  it("should always render the sidebar", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("animated-sidebar") !== null);
  });
});

describe("mainLayoutTemplate - notifications", () => {
  it("should pass notification counts to footer", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      numNotifications: 5,
      numChatNotifications: 3,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    // Footer should have status badges when there are notifications
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert(badges.length > 0);
  });
});
