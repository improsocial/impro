import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/trending-pane.js";
import { ApiError } from "/js/api.js";
import {
  installFakeIntersectionObserver,
  makeTestDataLayer,
  respondToConfirm,
} from "../../testHelpers.js";
import { createProfile, createTrend } from "../../../shared/factories.js";

describe("trending-pane", () => {
  function makeDataLayer(getTrends) {
    return makeTestDataLayer({ api: { getTrends } });
  }

  function mount(dataLayer, { isAuthenticated = true } = {}) {
    const element = document.createElement("trending-pane");
    element.dataLayer = dataLayer;
    element.isAuthenticated = isAuthenticated;
    document.body.appendChild(element);
    return element;
  }

  async function flushMicrotasks() {
    // Two ticks: the first flushes the load promise, the second lets the
    // rAF-scheduled effect render run before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function rowLabels(element) {
    return [...element.querySelectorAll("[data-testid='trending-row']")].map(
      (row) =>
        row.querySelector("[data-testid='trending-title']").textContent.trim(),
    );
  }

  let fakeIntersectionObserver;

  beforeEach(() => {
    document.body.innerHTML = "";
    fakeIntersectionObserver = installFakeIntersectionObserver({
      isIntersecting: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    fakeIntersectionObserver.restore();
  });

  it("renders skeleton rows before trends resolve", () => {
    const element = mount(makeDataLayer(() => new Promise(() => {})));
    assert.deepEqual(
      element.querySelectorAll("[data-testid='trending-skeleton']").length,
      4,
    );
  });

  it("renders rows linking to the trend target once loaded", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({ topic: "gardening", link: "/search?q=gardening" }),
        createTrend({
          topic: "cats",
          displayName: "Cats",
          link: "/hashtag/cats",
        }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    const rows = element.querySelectorAll("[data-testid='trending-row']");
    assert.deepEqual(rows.length, 2);
    assert.deepEqual(rowLabels(element), ["gardening", "Cats"]);
    assert.deepEqual(
      [...rows].map((row) => row.getAttribute("href")),
      ["/search?q=gardening", "/hashtag/cats"],
    );
  });

  it("keeps in-app paths and skips links that leave the app", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({ topic: "absolute", link: "https://evil.example/steal" }),
        createTrend({
          topic: "protocolRelative",
          link: "//evil.example/steal",
        }),
        createTrend({ topic: "backslash", link: "/\\evil.example/steal" }),
        createTrend({ topic: "profiles", link: "/profile/someone.test" }),
        createTrend({ topic: "good", link: "/search?q=good" }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(rowLabels(element), ["profiles", "good"]);
  });

  it("shows status, category and post count for an active trend", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({
          topic: "gardening",
          status: "hot",
          category: "news",
          postCount: 5251,
        }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    const row = element.querySelector("[data-testid='trending-row']");
    assert.deepEqual(
      row
        .querySelector("[data-testid='trending-status']")
        .getAttribute("data-teststate"),
      "active",
    );
    assert.deepEqual(
      row.querySelector("[data-testid='trending-category']").textContent.trim(),
      "News",
    );
    assert.deepEqual(
      row
        .querySelector("[data-testid='trending-post-count']")
        .textContent.trim(),
      `${(5251).toLocaleString()} posts`,
    );
  });

  it("shows the age of a trend that is no longer active and omits a missing category", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({
          topic: "gardening",
          postCount: 1,
          startedAt: new Date(Date.now() - 19.5 * 60 * 60 * 1000).toISOString(),
        }),
        createTrend({
          topic: "cats",
          startedAt: new Date(
            Date.now() - 2.5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    const statuses = [
      ...element.querySelectorAll("[data-testid='trending-status']"),
    ];
    assert.deepEqual(
      statuses.map((status) => status.getAttribute("data-teststate")),
      ["past", "past"],
    );
    assert.deepEqual(
      statuses.map((status) => status.textContent.trim()),
      ["19h", "2d"],
    );
    assert.deepEqual(
      element.querySelector("[data-testid='trending-category']"),
      null,
    );
    assert.deepEqual(
      element
        .querySelector("[data-testid='trending-post-count']")
        .textContent.trim(),
      "1 post",
    );
  });

  it("labels known categories and omits unrecognised ones", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({ topic: "rockets", category: "science-tech" }),
        createTrend({ topic: "mystery", category: "brand-new-category" }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    const rows = element.querySelectorAll("[data-testid='trending-row']");
    assert.deepEqual(
      rows[0]
        .querySelector("[data-testid='trending-category']")
        .textContent.trim(),
      "Science & Tech",
    );
    assert.deepEqual(
      rows[1].querySelector("[data-testid='trending-category']"),
      null,
    );
  });

  it("shows up to three actor avatars and none when a trend has no actors", async () => {
    const actors = ["a", "b", "c", "d"].map((name) =>
      createProfile({
        did: `did:plc:${name}`,
        handle: `${name}.test`,
        displayName: name,
      }),
    );
    const dataLayer = makeDataLayer(async () => ({
      trends: [
        createTrend({ topic: "gardening", actors }),
        createTrend({ topic: "cats" }),
      ],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    const rows = element.querySelectorAll("[data-testid='trending-row']");
    assert.deepEqual(
      rows[0].querySelectorAll("[data-testid='avatar-image']").length,
      3,
    );
    assert.deepEqual(
      rows[1].querySelector("[data-testid='trending-avatars']"),
      null,
    );
  });

  it("renders at most four rows", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: Array.from({ length: 14 }, (_, index) =>
        createTrend({ topic: `topic-${index}` }),
      ),
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelectorAll("[data-testid='trending-row']").length,
      4,
    );
  });

  it("renders nothing when there are no trends", async () => {
    const element = mount(makeDataLayer(async () => ({ trends: [] })));
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });

  it("renders nothing when trending is hidden", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    dataLayer.mutations.setTrendingHidden(true);
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });

  it("does not fetch trends until the pane is visible", async () => {
    fakeIntersectionObserver.setIntersecting(false);
    const getTrends = mock.fn(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(makeDataLayer(getTrends));
    await flushMicrotasks();
    assert.deepEqual(getTrends.mock.callCount(), 0);

    fakeIntersectionObserver.setIntersecting(true);
    await flushMicrotasks();
    assert.deepEqual(getTrends.mock.callCount(), 1);
    assert.deepEqual(rowLabels(element), ["gardening"]);
  });

  it("renders nothing when the request fails", async () => {
    const dataLayer = makeDataLayer(async () => {
      throw new ApiError({ status: 500, statusText: "Server Error", data: {} });
    });
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });

  it("omits the options button when logged out", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(dataLayer, { isAuthenticated: false });
    await flushMicrotasks();

    assert(element.querySelector("[data-testid='trending-pane']"));
    assert.deepEqual(
      element.querySelector("[data-testid='trending-options-button']"),
      null,
    );
  });

  it("opens a context menu with a hide action from the options button", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    element.querySelector("[data-testid='trending-options-button']").click();

    const menu = document.querySelector(".trending-context-menu");
    assert(menu);
    assert.deepEqual(menu.querySelectorAll("context-menu-item").length, 1);
    assert(menu.querySelector("[data-testid='menu-action-hide-trending']"));
    assert.deepEqual(dataLayer.derived.$trendingHidden.get(), false);
  });

  it("hides the pane after confirming the hide prompt", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    element.querySelector("[data-testid='trending-options-button']").click();
    document
      .querySelector("[data-testid='menu-action-hide-trending'] button")
      .click();
    await respondToConfirm(true);
    await flushMicrotasks();

    assert(dataLayer.derived.$trendingHidden.get());
    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });
});
