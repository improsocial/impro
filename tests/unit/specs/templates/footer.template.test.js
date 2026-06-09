import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { footerTemplate } from "/js/templates/footer.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("footerTemplate");

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
};

t.describe("footerTemplate - logged out state", (it) => {
  it("should render logged out footer when not authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='logged-out-footer']") !== null,
    );
  });

  it("should render sign in button when not authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const loginButton = container.querySelector("[data-testid='login-button']");
    assert(loginButton !== null);
  });

  it("should render brand title when not authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const title = container.querySelector("[data-testid='brand-title']");
    assert(title !== null);
  });
});

t.describe("footerTemplate - logged in state", (it) => {
  it("should render footer nav when authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='footer-nav']") !== null);
    assertEquals(
      container.querySelector("[data-testid='logged-out-footer']"),
      null,
    );
  });

  it("should render nav element when authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("nav") !== null);
  });

  it("should render home nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const homeLink = container.querySelector("[data-testid='footer-nav-home']");
    assert(homeLink !== null);
  });

  it("should render search nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const searchLink = container.querySelector(
      "[data-testid='footer-nav-search']",
    );
    assert(searchLink !== null);
  });

  it("should render messages nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const chatLink = container.querySelector("[data-testid='footer-nav-chat']");
    assert(chatLink !== null);
  });

  it("should render notifications nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const notificationsLink = container.querySelector(
      "[data-testid='footer-nav-notifications']",
    );
    assert(notificationsLink !== null);
  });

  it("should render profile nav item with user handle", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const profileLink = container.querySelector(
      "[data-testid='footer-nav-profile']",
    );
    assert(profileLink !== null);
  });

  it("should mark active nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      activeNavItem: "home",
    });
    const container = document.createElement("div");
    render(result, container);
    const activeItem = container.querySelector(
      "[data-testid='footer-nav-home'].active",
    );
    assert(activeItem !== null);
    assertEquals(activeItem.getAttribute("href"), "/");
  });
});

t.describe("footerTemplate - notification badges", (it) => {
  it("should show notification badge when numNotifications > 0", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      numNotifications: 5,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert(badges.length > 0);
  });

  it("should show chat notification badge when numChatNotifications > 0", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      numChatNotifications: 3,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert(badges.length > 0);
  });

  it("should not show badges when notification counts are 0", () => {
    const result = footerTemplate({
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

t.describe("footerTemplate - profile long-press", (it) => {
  function renderFooter({ onLongPressProfile = null } = {}) {
    const container = document.createElement("div");
    render(
      footerTemplate({
        isAuthenticated: true,
        currentUser: mockUser,
        onLongPressProfile,
      }),
      container,
    );
    return container.querySelector("[data-testid='footer-nav-profile']");
  }

  it("marks the profile item long-press-enabled when a handler is provided", () => {
    const profileLink = renderFooter({ onLongPressProfile: () => {} });
    assert(profileLink.classList.contains("long-press-enabled"));
  });

  it("does not mark the profile item when no handler is provided", () => {
    const profileLink = renderFooter();
    assert(!profileLink.classList.contains("long-press-enabled"));
  });

  // Press timing and click suppression are enableLongPress behavior, covered
  // in utils.test.js; here we only verify the footer wires the handler up.
  it("invokes the handler when a long-press fires on the profile item", () => {
    let fired = 0;
    const profileLink = renderFooter({ onLongPressProfile: () => fired++ });
    profileLink.dispatchEvent(new CustomEvent("long-press"));
    assertEquals(fired, 1);
  });
});

t.describe("footerTemplate - safe area", (it) => {
  it("should render footer safe area div", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='footer-safe-area']") !== null,
    );
  });
});

await t.run();
