import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  mainLayoutTemplate,
  createMainLayout,
} from "/js/templates/mainLayout.template.js";
import { render, html } from "/js/lib/lit-html.js";

const t = new TestSuite("mainLayoutTemplate");

const mockUser = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
  followersCount: 100,
  followsCount: 50,
};

const mockPluginService = {
  getSidebarItems: () => [],
};

t.describe("mainLayoutTemplate", (it) => {
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

t.describe("mainLayoutTemplate - footer", (it) => {
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

t.describe("mainLayoutTemplate - floating compose button", (it) => {
  it("should not render floating compose button by default", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='floating-compose-button']"),
      null,
    );
  });

  it("should render floating compose button when showFloatingComposeButton is true", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      showFloatingComposeButton: true,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(
      container.querySelector("[data-testid='floating-compose-button']") !==
        null,
    );
  });

  it("should not render floating compose button when no currentUser", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: null,
      showFloatingComposeButton: true,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(
      container.querySelector("[data-testid='floating-compose-button']"),
      null,
    );
  });

  it("should call onClickComposeButton when floating button is clicked", () => {
    let clicked = false;
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      showFloatingComposeButton: true,
      onClickComposeButton: () => {
        clicked = true;
      },
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    container.querySelector("[data-testid='floating-compose-button']").click();
    assert(clicked);
  });
});

t.describe("mainLayoutTemplate - sidebar", (it) => {
  it("should render sidebar when showSidebarOverlay is true", () => {
    const result = mainLayoutTemplate({
      pluginService: mockPluginService,
      isAuthenticated: true,
      currentUser: mockUser,
      showSidebarOverlay: true,
      children: html`<div>Content</div>`,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("animated-sidebar") !== null);
  });
});

t.describe("mainLayoutTemplate - notifications", (it) => {
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

t.describe("createMainLayout", (it, { beforeEach }) => {
  let state;
  let mainLayout;
  let container;

  beforeEach(() => {
    state = {
      currentUser: mockUser,
      numNotifications: 0,
      numChatNotifications: 0,
      composeCalls: [],
    };
    const context = {
      isAuthenticated: true,
      dataLayer: {
        derived: { $currentUser: { get: () => state.currentUser } },
      },
      notificationService: {
        $numNotifications: { get: () => state.numNotifications },
      },
      chatNotificationService: {
        $numNotifications: { get: () => state.numChatNotifications },
      },
      postComposerService: {
        composePost: (args) => state.composeCalls.push(args),
      },
      pluginService: mockPluginService,
    };
    mainLayout = createMainLayout(context);
    container = document.createElement("div");
  });

  it("should bind shared layout args from context", () => {
    state.numNotifications = 5;
    render(mainLayout({ children: html`<div>Content</div>` }), container);
    assert(container.querySelector("[data-testid='footer-nav']") !== null);
    assert(
      container.querySelectorAll("[data-testid='status-badge']").length > 0,
    );
  });

  it("should read signals at invoke time, not at creation time", () => {
    render(mainLayout({ children: html`<div>Content</div>` }), container);
    assertEquals(
      container.querySelectorAll("[data-testid='status-badge']").length,
      0,
    );
    state.numNotifications = 5;
    render(mainLayout({ children: html`<div>Content</div>` }), container);
    assert(
      container.querySelectorAll("[data-testid='status-badge']").length > 0,
    );
  });

  it("should default the compose handler to the post composer", () => {
    render(
      mainLayout({
        showFloatingComposeButton: true,
        children: html`<div>Content</div>`,
      }),
      container,
    );
    container.querySelector("[data-testid='floating-compose-button']").click();
    assertEquals(state.composeCalls.length, 1);
    assertEquals(state.composeCalls[0].currentUser, mockUser);
  });

  it("should let explicit options override bound defaults", () => {
    let clicked = false;
    render(
      mainLayout({
        showFloatingComposeButton: true,
        onClickComposeButton: () => {
          clicked = true;
        },
        children: html`<div>Content</div>`,
      }),
      container,
    );
    container.querySelector("[data-testid='floating-compose-button']").click();
    assert(clicked);
    assertEquals(state.composeCalls.length, 0);
  });
});

await t.run();
