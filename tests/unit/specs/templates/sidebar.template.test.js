import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { render } from "/js/lib/lit-html.js";
import { raf } from "/js/utils.js";

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
  followersCount: 100,
  followsCount: 50,
};

describe("sidebarTemplate - logged out state", () => {
  it("should render logged out sidebar when not authenticated", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='logged-out-sidebar']") !== null,
    );
  });

  it("should render IMPRO title when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const title = container.querySelector("h1");
    assert(title !== null);
    assert(title.textContent.includes("IMPRO"));
  });

  it("should render sign in button when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const loginButton = container.querySelector("[data-testid='login-button']");
    assert(loginButton !== null);
    assert(loginButton.textContent.includes("Sign in"));
  });

  it("should render home nav item when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const homeLink = container.querySelector(
      "[data-testid='sidebar-nav-home']",
    );
    assert(homeLink !== null);
  });

  it("should render search nav item when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const searchLink = container.querySelector(
      "[data-testid='sidebar-nav-search']",
    );
    assert(searchLink !== null);
  });

  it("should render plugins nav item linking to community plugins when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const pluginsLink = container.querySelector(
      "[data-testid='sidebar-nav-plugins']",
    );
    assert(pluginsLink !== null);
    assert.equal(pluginsLink.getAttribute("href"), "/plugins/community");
  });

  it("should render about link when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const aboutLink = container.querySelector(
      "[data-testid='sidebar-about-link']",
    );
    assert(aboutLink !== null);
  });
});

describe("sidebarTemplate - welcome modal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should open the welcome modal when the about link is clicked", () => {
    const container = document.createElement("div");
    render(
      sidebarTemplate({ isAuthenticated: false, currentUser: null }),
      container,
    );
    document.body.appendChild(container);
    container.querySelector("[data-testid='sidebar-about-link']").click();
    const dialog = document.querySelector('[data-testid="welcome-modal"]');
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
  });
});

describe("sidebarTemplate - logged in state", () => {
  it("should render animated-sidebar when authenticated", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("animated-sidebar") !== null);
  });

  it("should render profile section when authenticated", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='sidebar-profile']") !== null);
  });

  it("should render user display name", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const name = container.querySelector(
      "[data-testid='sidebar-profile-name']",
    );
    assert(name !== null);
    assert(name.textContent.includes("Test User"));
  });

  it("should render user handle with @ prefix", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const handle = container.querySelector(
      "[data-testid='sidebar-profile-handle']",
    );
    assert(handle !== null);
    assert(handle.textContent.includes("@testuser.bsky.social"));
  });

  it("should render followers count", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const stats = container.querySelector(
      "[data-testid='sidebar-profile-stats']",
    );
    assert(stats !== null);
    assert(stats.textContent.includes("100"));
    assert(stats.textContent.includes("followers"));
  });

  it("should render following count", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const stats = container.querySelector(
      "[data-testid='sidebar-profile-stats']",
    );
    assert(stats !== null);
    assert(stats.textContent.includes("50"));
    assert(stats.textContent.includes("following"));
  });

  it("should omit the stats row for a partial profile", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: { ...mockUser, isPartial: true },
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='sidebar-profile-stats']"),
      null,
    );
    const handle = container.querySelector(
      "[data-testid='sidebar-profile-handle']",
    );
    assert(handle !== null);
  });
});

describe("sidebarTemplate - nav items", () => {
  it("should close before navigating to an inactive item", async () => {
    const originalRouter = window.router;
    const go = mock.fn();
    window.router = { go };
    const container = document.createElement("div");
    container.className = "page-visible";
    document.body.appendChild(container);

    try {
      render(
        sidebarTemplate({
          isAuthenticated: true,
          currentUser: mockUser,
          activeNavItem: "home",
        }),
        container,
      );
      const sidebar = container.querySelector("animated-sidebar");
      const dialog = sidebar.querySelector("dialog.sidebar");
      sidebar.isOpen = true;
      dialog.showModal();

      container.querySelector("[data-testid='sidebar-nav-search']").click();

      assert.deepEqual(sidebar.isOpen, false);
      assert(!dialog.open);
      assert.deepEqual(go.mock.callCount(), 0);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await Promise.resolve();
      assert.deepEqual(go.mock.calls[0].arguments, ["/search"]);
    } finally {
      container.remove();
      window.router = originalRouter;
    }
  });

  it("should render home nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-home']") !== null,
    );
  });

  it("should render search nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-search']") !== null,
    );
  });

  it("should render notifications nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-notifications']") !==
        null,
    );
  });

  it("should render chat nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-chat']") !== null,
    );
  });

  it("should render feeds nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-feeds']") !== null,
    );
  });

  it("should render bookmarks nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-bookmarks']") !== null,
    );
  });

  it("should render profile nav item with user DID", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const profileLink = container.querySelector(
      "[data-testid='sidebar-nav-profile']",
    );
    assert(profileLink !== null);
  });

  it("should render plugins nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-plugins']") !== null,
    );
  });

  it("should render settings nav item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-nav-settings']") !== null,
    );
  });
});

describe("sidebarTemplate - notification badges", () => {
  it("should show notification badge when numNotifications > 0", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      numNotifications: 5,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert(badges.length > 0);
  });

  it("should show chat badge when numChatNotifications > 0", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      numChatNotifications: 3,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert(badges.length > 0);
  });

  it("should not show badges when counts are 0", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      numNotifications: 0,
      numChatNotifications: 0,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert.deepEqual(badges.length, 0);
  });
});

describe("sidebarTemplate - compose button", () => {
  it("should render compose button when onClickComposeButton is provided", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      onClickComposeButton: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-compose-button']") !==
        null,
    );
  });

  it("should not render compose button when onClickComposeButton is not provided", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='sidebar-compose-button']"),
      null,
    );
  });

  it("should call onClickComposeButton when compose button is clicked", () => {
    let clicked = false;
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      onClickComposeButton: () => {
        clicked = true;
      },
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='sidebar-compose-button']").click();
    assert(clicked);
  });

  it("should render compose button when chat nav item is active", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      activeNavItem: "chat",
      onClickComposeButton: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='sidebar-compose-button']") !==
        null,
    );
  });
});

describe("sidebarTemplate - profile long-press", () => {
  function renderSidebar({ onLongPressProfile = null } = {}) {
    const container = document.createElement("div");
    render(
      sidebarTemplate({
        isAuthenticated: true,
        currentUser: mockUser,
        onLongPressProfile,
      }),
      container,
    );
    return container.querySelector(".sidebar-profile-avatar");
  }

  it("invokes the handler when a long-press fires on the profile avatar", () => {
    let fired = 0;
    const avatar = renderSidebar({ onLongPressProfile: () => fired++ });
    avatar.dispatchEvent(new CustomEvent("long-press"));
    assert.deepEqual(fired, 1);
  });

  it("does not throw when a long-press fires and no handler is provided", () => {
    const avatar = renderSidebar();
    avatar.dispatchEvent(new CustomEvent("long-press"));
  });
});

describe("sidebarTemplate - plugin sidebar items", () => {
  it("should not render any plugin items when pluginSidebarItems is empty", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [],
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelectorAll(".sidebar-plugin-nav-item").length,
      0,
    );
  });

  it("should render a button for each plugin sidebar item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [
        { title: "Plugin One", icon: "lightning-bolt", invoke: () => {} },
        { title: "Plugin Two", icon: "lightning-bolt", invoke: () => {} },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    const pluginItems = container.querySelectorAll(".sidebar-plugin-nav-item");
    assert.deepEqual(pluginItems.length, 2);
  });

  it("should render plugin item title as label and tooltip", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [
        { title: "Plugin One", icon: "lightning-bolt", invoke: () => {} },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    const pluginItem = container.querySelector(".sidebar-plugin-nav-item");
    assert(pluginItem !== null);
    assert.deepEqual(pluginItem.getAttribute("title"), "Plugin One");
    assert(pluginItem.textContent.includes("Plugin One"));
  });

  it("should call entry.invoke when plugin item is clicked", () => {
    let invoked = false;
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [
        {
          title: "Plugin One",
          icon: "lightning-bolt",
          invoke: () => {
            invoked = true;
          },
        },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector(".sidebar-plugin-nav-item").click();
    assert(invoked);
  });

  it("should render the entry's iconElement for each plugin item", () => {
    const makeAppIcon = (name) => {
      const el = document.createElement("app-icon");
      el.setAttribute("icon", name);
      return el;
    };
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [
        {
          title: "Plugin One",
          icon: "lightning-bolt",
          iconElement: makeAppIcon("lightning-bolt"),
          invoke: () => {},
        },
        {
          title: "Plugin Two",
          icon: "bell",
          iconElement: makeAppIcon("bell"),
          invoke: () => {},
        },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    const icons = container.querySelectorAll(
      ".sidebar-plugin-nav-item app-icon",
    );
    assert.deepEqual(icons.length, 2);
    assert.deepEqual(icons[0].getAttribute("icon"), "lightning-bolt");
    assert.deepEqual(icons[1].getAttribute("icon"), "bell");
  });

  it("should not render plugin sidebar items in logged out sidebar", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
      pluginSidebarItems: [
        { title: "Plugin One", icon: "lightning-bolt", invoke: () => {} },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelectorAll(".sidebar-plugin-nav-item").length,
      0,
    );
  });
});

describe("sidebarTemplate - active nav item clicks", () => {
  let originalRouter;
  let go;

  beforeEach(() => {
    originalRouter = window.router;
    go = mock.fn();
    // the non-active branch navigates in-app rather than following the href
    window.router = { go };
  });

  afterEach(() => {
    window.router = originalRouter;
  });

  // The non-active branch navigates after two animation frames, so let the
  // handler settle while the router stub is still installed.
  async function clickNavItem({
    isNavItemPage,
    activeNavItem = "chat",
    id = "chat",
  }) {
    const onClickActiveItem = mock.fn();
    const container = document.createElement("div");
    render(
      sidebarTemplate({
        isAuthenticated: true,
        currentUser: mockUser,
        activeNavItem,
        isNavItemPage,
        onClickActiveItem,
      }),
      container,
    );
    const link = container.querySelector(`[data-testid="sidebar-nav-${id}"]`);
    const event = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);
    await raf();
    await raf();
    return { onClickActiveItem, event };
  }

  it("claims the click when already on the item's own page", async () => {
    const { onClickActiveItem, event } = await clickNavItem({
      isNavItemPage: true,
    });
    assert.equal(onClickActiveItem.mock.calls.length, 1);
    assert(event.defaultPrevented);
  });

  it("navigates instead of claiming the click from a deeper page in the same section", async () => {
    const { onClickActiveItem } = await clickNavItem({ isNavItemPage: false });
    assert.equal(onClickActiveItem.mock.calls.length, 0);
    assert.equal(go.mock.calls.length, 1);
  });

  it("claims the click on the user's own profile despite the did/handle url", async () => {
    const { onClickActiveItem } = await clickNavItem({
      isNavItemPage: true,
      activeNavItem: "profile",
      id: "profile",
    });
    assert.equal(onClickActiveItem.mock.calls.length, 1);
  });
});
