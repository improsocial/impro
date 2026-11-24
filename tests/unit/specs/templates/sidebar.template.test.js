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

  it("should render sign in button when logged out", () => {
    const result = sidebarTemplate({
      isAuthenticated: false,
      currentUser: null,
    });
    const container = document.createElement("div");
    render(result, container);
    const loginButton = container.querySelector("[data-testid='login-button']");
    assert(loginButton !== null);
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

  it("should render verification and automated account badges next to the display name", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: {
        ...mockUser,
        verification: {
          verifiedStatus: "valid",
          trustedVerifierStatus: "none",
        },
        labels: [{ val: "bot" }],
      },
    });
    const container = document.createElement("div");
    render(result, container);
    const name = container.querySelector(
      "[data-testid='sidebar-profile-name']",
    );
    assert(name.querySelector("[data-testid='verification-badge']") !== null);
    assert(
      name.querySelector("[data-testid='automated-account-badge']") !== null,
    );
  });

  it("should not render badges for an unverified, non-automated user", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const name = container.querySelector(
      "[data-testid='sidebar-profile-name']",
    );
    assert.deepEqual(
      name.querySelector("[data-testid='verification-badge']"),
      null,
    );
    assert.deepEqual(
      name.querySelector("[data-testid='automated-account-badge']"),
      null,
    );
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
    const followers = container.querySelector(
      "[data-testid='sidebar-profile-followers']",
    );
    assert(followers !== null);
    assert(followers.textContent.includes("100"));
  });

  it("should render following count", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
    });
    const container = document.createElement("div");
    render(result, container);
    const following = container.querySelector(
      "[data-testid='sidebar-profile-following']",
    );
    assert(following !== null);
    assert(following.textContent.includes("50"));
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
  it("should navigate to an inactive item with the sidebar open, then close it", async () => {
    const originalRouter = window.router;
    let dialog = null;
    let sidebarOpenDuringNavigation = null;
    const go = mock.fn(async () => {
      sidebarOpenDuringNavigation = dialog.open;
    });
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
      dialog = sidebar.querySelector("dialog.sidebar");
      sidebar.isOpen = true;
      dialog.showModal();

      container.querySelector("[data-testid='sidebar-nav-search']").click();

      assert.deepEqual(go.mock.calls[0].arguments, ["/search"]);
      assert.deepEqual(sidebarOpenDuringNavigation, true);
      await raf();
      assert.deepEqual(sidebar.isOpen, false);
      assert(!dialog.open);
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
  it("should render an enabled compose button when currentUser is loaded", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: mockUser,
      onClickComposeButton: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector(
      "[data-testid='sidebar-compose-button']",
    );
    assert(button !== null);
    assert(!button.disabled);
  });

  it("should render a disabled compose button when currentUser is not loaded", () => {
    const result = sidebarTemplate({
      isAuthenticated: true,
      currentUser: null,
      onClickComposeButton: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const button = container.querySelector(
      "[data-testid='sidebar-compose-button']",
    );
    assert(button !== null);
    assert(button.disabled);
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

describe("sidebarTemplate - profile account switcher button", () => {
  function renderSidebar({
    onOpenAccountSwitcher = () => {},
    onSwitchAccount = () => {},
    otherAccounts = [],
    pendingSwitchDid = null,
  } = {}) {
    const container = document.createElement("div");
    render(
      sidebarTemplate({
        isAuthenticated: true,
        currentUser: mockUser,
        onOpenAccountSwitcher,
        onSwitchAccount,
        otherAccounts,
        pendingSwitchDid,
      }),
      container,
    );
    return container;
  }

  function getSwitcherButton(container) {
    return container.querySelector(
      "[data-testid='sidebar-profile-account-switcher-button']",
    );
  }

  it("invokes the handler when the button is clicked", () => {
    let fired = 0;
    const container = renderSidebar({ onOpenAccountSwitcher: () => fired++ });
    getSwitcherButton(container).click();
    assert.deepEqual(fired, 1);
  });

  it("is not rendered when no handler is provided", () => {
    const container = renderSidebar({ onOpenAccountSwitcher: null });
    assert.deepEqual(getSwitcherButton(container), null);
  });

  it("shows only the ellipsis button while other accounts are loading", () => {
    const container = renderSidebar({ otherAccounts: null });
    assert(getSwitcherButton(container));
    assert.deepEqual(
      container.querySelector("[data-testid='sidebar-account-avatar-stack']"),
      null,
    );
  });

  it("shows only the ellipsis button when there are no other accounts", () => {
    const container = renderSidebar();
    assert(getSwitcherButton(container));
    assert.deepEqual(
      container.querySelector("[data-testid='sidebar-account-avatar-stack']"),
      null,
    );
  });

  function makeAccount(did) {
    return { did, handle: `${did}.test`, needsReauth: false };
  }

  it("shows a stack of other account avatars next to an ellipsis button", () => {
    const otherProfile = { ...mockUser, did: "did:plc:other" };
    const container = renderSidebar({
      otherAccounts: [
        { account: makeAccount("did:plc:other"), profile: otherProfile },
        { account: makeAccount("did:plc:third"), profile: null },
      ],
    });
    assert(getSwitcherButton(container));
    const items = container.querySelectorAll(
      "[data-testid='sidebar-account-stack-item']",
    );
    assert.deepEqual(
      [...items].map((item) => item.dataset.did),
      ["did:plc:other", "did:plc:third"],
    );
  });

  it("switches to an account when its avatar is clicked", () => {
    const onSwitchAccount = mock.fn();
    const account = makeAccount("did:plc:third");
    const container = renderSidebar({
      onSwitchAccount,
      otherAccounts: [
        { account: makeAccount("did:plc:other"), profile: null },
        { account, profile: null },
      ],
    });
    container
      .querySelector(
        "[data-testid='sidebar-account-stack-item'][data-did='did:plc:third']",
      )
      .click();
    assert.deepEqual(onSwitchAccount.mock.calls.length, 1);
    assert.equal(onSwitchAccount.mock.calls[0].arguments[0], account);
  });

  it("marks the avatar of the account being switched to as selected", () => {
    const container = renderSidebar({
      pendingSwitchDid: "did:plc:third",
      otherAccounts: [
        { account: makeAccount("did:plc:other"), profile: null },
        { account: makeAccount("did:plc:third"), profile: null },
      ],
    });
    const items = container.querySelectorAll(
      "[data-testid='sidebar-account-stack-item']",
    );
    assert.deepEqual(
      [...items].map((item) => item.dataset.teststate),
      ["idle", "selected"],
    );
  });

  it("leaves accounts that need to sign in again out of the stack", () => {
    const container = renderSidebar({
      otherAccounts: [
        {
          account: { ...makeAccount("did:plc:reauth"), needsReauth: true },
          profile: null,
        },
        ...["one", "two", "three"].map((name) => ({
          account: makeAccount(`did:plc:${name}`),
          profile: null,
        })),
      ],
    });
    const items = container.querySelectorAll(
      "[data-testid='sidebar-account-stack-item']",
    );
    assert.deepEqual(
      [...items].map((item) => item.dataset.did),
      ["did:plc:one", "did:plc:two", "did:plc:three"],
    );
  });

  it("omits the stack when every other account needs to sign in again", () => {
    const container = renderSidebar({
      otherAccounts: [
        {
          account: { ...makeAccount("did:plc:reauth"), needsReauth: true },
          profile: null,
        },
      ],
    });
    assert(getSwitcherButton(container));
    assert.deepEqual(
      container.querySelector("[data-testid='sidebar-account-avatar-stack']"),
      null,
    );
  });

  it("caps the avatar stack at three accounts", () => {
    const container = renderSidebar({
      otherAccounts: Array.from({ length: 7 }, (_, i) => ({
        account: makeAccount(`did:plc:account${i}`),
        profile: null,
      })),
    });
    assert.deepEqual(
      container.querySelectorAll("[data-testid='sidebar-account-stack-item']")
        .length,
      3,
    );
  });
});

describe("sidebarTemplate - account row", () => {
  let originalRouter;
  let go;

  beforeEach(() => {
    originalRouter = window.router;
    go = mock.fn();
    window.router = { go };
  });

  afterEach(() => {
    window.router = originalRouter;
  });

  function renderSidebar({ currentUser = mockUser, onOpenAccountSwitcher }) {
    const container = document.createElement("div");
    render(
      sidebarTemplate({
        isAuthenticated: true,
        currentUser,
        onOpenAccountSwitcher,
      }),
      container,
    );
    return container;
  }

  it("renders the current user's name and handle", () => {
    const container = renderSidebar({ onOpenAccountSwitcher: () => {} });
    const account = container.querySelector("[data-testid='sidebar-account']");
    assert(account.textContent.includes("Test User"));
    assert(account.textContent.includes("@testuser.bsky.social"));
  });

  it("renders a skeleton instead of the account row without a current user", () => {
    const container = renderSidebar({
      currentUser: null,
      onOpenAccountSwitcher: () => {},
    });
    assert.equal(
      container.querySelector("[data-testid='sidebar-account']"),
      null,
    );
    assert(
      container.querySelector("[data-testid='sidebar-account-skeleton']") !==
        null,
    );
  });

  it("does not render the skeleton once the current user is loaded", () => {
    const container = renderSidebar({ onOpenAccountSwitcher: () => {} });
    assert.equal(
      container.querySelector("[data-testid='sidebar-account-skeleton']"),
      null,
    );
  });

  it("opens the account switcher when the row is clicked", () => {
    const onOpenAccountSwitcher = mock.fn();
    const container = renderSidebar({ onOpenAccountSwitcher });
    container
      .querySelector("[data-testid='sidebar-account-switcher-button']")
      .click();
    assert.equal(onOpenAccountSwitcher.mock.callCount(), 1);
    assert.equal(go.mock.callCount(), 0);
  });

  it("navigates to the profile when the avatar is clicked", async () => {
    const onOpenAccountSwitcher = mock.fn();
    const container = renderSidebar({ onOpenAccountSwitcher });
    container.querySelector("[data-testid='sidebar-account-avatar']").click();
    await raf();
    await raf();
    await Promise.resolve();
    assert.equal(onOpenAccountSwitcher.mock.callCount(), 0);
    assert.deepEqual(go.mock.calls[0].arguments, [`/profile/${mockUser.did}`]);
  });

  it("omits the switcher button when account switching is unavailable", () => {
    const container = renderSidebar({ onOpenAccountSwitcher: null });
    assert.equal(
      container.querySelector(
        "[data-testid='sidebar-account-switcher-button']",
      ),
      null,
    );
    assert(
      container.querySelector("[data-testid='sidebar-account-avatar']") !==
        null,
    );
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

describe("sidebarTemplate - site links", () => {
  const siteLinkTestIds = [
    "footer-link-terms",
    "footer-link-privacy",
    "footer-link-source",
    "footer-link-support",
  ];

  it("should render the site links when logged out", () => {
    const container = document.createElement("div");
    render(
      sidebarTemplate({ isAuthenticated: false, currentUser: null }),
      container,
    );
    for (const testId of siteLinkTestIds) {
      assert(container.querySelector(`[data-testid="${testId}"]`) !== null);
    }
  });

  it("should not render the site links when logged in", () => {
    const container = document.createElement("div");
    render(
      sidebarTemplate({ isAuthenticated: true, currentUser: mockUser }),
      container,
    );
    for (const testId of siteLinkTestIds) {
      assert.deepEqual(
        container.querySelector(`[data-testid="${testId}"]`),
        null,
      );
    }
  });
});
