import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
} from "/js/templates/profileListItem.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("profileListItemTemplate");

const mockActor = {
  did: "did:plc:testuser",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "https://example.com/avatar.jpg",
};

t.describe("profileListItemTemplate", (it) => {
  it("should render avatar", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render display name", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName !== null);
    assert(displayName.textContent.includes("Test User"));
  });

  it("should render handle with @ prefix", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const handle = container.querySelector(
      "[data-testid='profile-list-item-handle']",
    );
    assert(handle !== null);
    assert(handle.textContent.includes("@testuser.bsky.social"));
  });

  it("should render profile link", () => {
    const result = profileListItemTemplate({ actor: mockActor });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector(".profile-list-item-name");
    assert(link !== null);
    assert(link.getAttribute("href").includes(mockActor.handle));
  });
});

t.describe("profileListItemTemplate - no display name", (it) => {
  it("should use handle as display name when displayName is missing", () => {
    const actorWithoutDisplayName = {
      ...mockActor,
      displayName: null,
    };
    const result = profileListItemTemplate({ actor: actorWithoutDisplayName });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes(mockActor.handle));
  });

  it("should use handle as display name when displayName is empty", () => {
    const actorWithEmptyDisplayName = {
      ...mockActor,
      displayName: "",
    };
    const result = profileListItemTemplate({
      actor: actorWithEmptyDisplayName,
    });
    const container = document.createElement("div");
    render(result, container);
    const displayName = container.querySelector(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(displayName.textContent.includes(mockActor.handle));
  });
});

t.describe("profileListItemSkeletonTemplate", (it) => {
  it("should render skeleton avatar", () => {
    const result = profileListItemSkeletonTemplate();
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='skeleton-avatar']") !== null);
  });
});

await t.run();
