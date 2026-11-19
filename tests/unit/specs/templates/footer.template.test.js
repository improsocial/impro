import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { footerTemplate } from "/js/templates/footer.template.js";
import { render } from "/js/lib/lit-html.js";

describe("footerTemplate - logged out state", () => {
  it("should render logged out footer when not authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: false,
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
    });
    const container = document.createElement("div");
    render(result, container);
    const loginButton = container.querySelector("[data-testid='login-button']");
    assert(loginButton !== null);
  });
});

describe("footerTemplate - logged in state", () => {
  it("should render footer nav when authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='footer-nav']") !== null);
    assert.deepEqual(
      container.querySelector("[data-testid='logged-out-footer']"),
      null,
    );
  });

  it("should render nav element when authenticated", () => {
    const result = footerTemplate({
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("nav") !== null);
  });

  it("should render home nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const homeLink = container.querySelector("[data-testid='footer-nav-home']");
    assert(homeLink !== null);
  });

  it("should render search nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
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
    });
    const container = document.createElement("div");
    render(result, container);
    const chatLink = container.querySelector("[data-testid='footer-nav-chat']");
    assert(chatLink !== null);
  });

  it("should render notifications nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const notificationsLink = container.querySelector(
      "[data-testid='footer-nav-notifications']",
    );
    assert(notificationsLink !== null);
  });

  it("should render plugins nav item", () => {
    const result = footerTemplate({ isAuthenticated: true });
    const container = document.createElement("div");
    render(result, container);
    const pluginsLink = container.querySelector(
      "[data-testid='footer-nav-plugins']",
    );
    assert.deepEqual(pluginsLink.getAttribute("href"), "/plugins/installed");
  });

  it("should not render a profile nav item", () => {
    const result = footerTemplate({ isAuthenticated: true });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container.querySelector("[data-testid='footer-nav-profile']"),
      null,
    );
  });

  it("should order nav items home, search, plugins, notifications, chat", () => {
    const result = footerTemplate({ isAuthenticated: true });
    const container = document.createElement("div");
    render(result, container);
    const ids = [...container.querySelectorAll(".footer-nav-item")].map(
      (item) => item.dataset.testid,
    );
    assert.deepEqual(ids, [
      "footer-nav-home",
      "footer-nav-search",
      "footer-nav-plugins",
      "footer-nav-notifications",
      "footer-nav-chat",
    ]);
  });

  it("should mark active nav item", () => {
    const result = footerTemplate({
      isAuthenticated: true,
      activeNavItem: "home",
    });
    const container = document.createElement("div");
    render(result, container);
    const activeItem = container.querySelector(
      "[data-testid='footer-nav-home'].active",
    );
    assert(activeItem !== null);
    assert.deepEqual(activeItem.getAttribute("href"), "/");
  });
});

describe("footerTemplate - notification badges", () => {
  it("should show notification badge when numNotifications > 0", () => {
    const result = footerTemplate({
      isAuthenticated: true,
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
      numNotifications: 0,
      numChatNotifications: 0,
    });
    const container = document.createElement("div");
    render(result, container);
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    assert.deepEqual(badges.length, 0);
  });
});
