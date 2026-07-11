import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { render } from "/js/lib/lit-html.js";

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
});

describe("sidebarTemplate - nav items", () => {
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

  it("should render a <plugin-icon> with the entry's icon for each plugin item", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      pluginSidebarItems: [
        { title: "Plugin One", icon: "lightning-bolt", invoke: () => {} },
        { title: "Plugin Two", icon: "bell", invoke: () => {} },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    const icons = container.querySelectorAll(
      ".sidebar-plugin-nav-item plugin-icon",
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
