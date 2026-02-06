import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("sidebarTemplate");

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
  followersCount: 100,
  followsCount: 50,
};

t.describe("sidebarTemplate - logged out state", (it) => {
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

t.describe("sidebarTemplate - logged in state", (it) => {
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

t.describe("sidebarTemplate - nav items", (it) => {
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

t.describe("sidebarTemplate - notification badges", (it) => {
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
    assertEquals(badges.length, 0);
  });
});

t.describe("sidebarTemplate - compose button", (it) => {
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
    assertEquals(
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

t.describe("sidebarTemplate - footer", (it) => {
  it("should render sidebar footer", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='sidebar-footer']") !== null);
  });

  it("should render bug report link", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const footer = container.querySelector("[data-testid='sidebar-footer']");
    assert(footer.textContent.includes("Bug report"));
  });
});

await t.run();
