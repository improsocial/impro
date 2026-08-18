import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/trending-pane.js";
import { displayPreferences } from "/js/displayPreferences.js";
import { ApiError } from "/js/api.js";
import { makeTestDataLayer, respondToConfirm } from "../../testHelpers.js";
import { createTrend } from "../../../shared/factories.js";

describe("trending-pane", () => {
  function makeDataLayer(getTrends) {
    return makeTestDataLayer({ api: { getTrends } });
  }

  function mount(dataLayer) {
    const element = document.createElement("trending-pane");
    element.dataLayer = dataLayer;
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
      (row) => row.querySelector(".trending-label").textContent.trim(),
    );
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    displayPreferences.$trendingHidden.set(false);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    displayPreferences.$trendingHidden.set(false);
  });

  it("renders skeleton rows before trends resolve", () => {
    const element = mount(makeDataLayer(() => new Promise(() => {})));
    assert.deepEqual(
      element.querySelectorAll("[data-testid='trending-skeleton']").length,
      5,
    );
  });

  it("renders ranked rows linking to the trend target once loaded", async () => {
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
    assert.deepEqual(
      [...element.querySelectorAll(".trending-rank")].map((rank) =>
        rank.textContent.trim(),
      ),
      ["1.", "2."],
    );
  });

  it("keeps in-app paths and skips links that leave the app, renumbering the rest", async () => {
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
    assert.deepEqual(
      [...element.querySelectorAll(".trending-rank")].map((rank) =>
        rank.textContent.trim(),
      ),
      ["1.", "2."],
    );
  });

  it("renders at most five rows", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: Array.from({ length: 9 }, (_, index) =>
        createTrend({ topic: `topic-${index}` }),
      ),
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelectorAll("[data-testid='trending-row']").length,
      5,
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
    displayPreferences.$trendingHidden.set(true);
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });

  it("shows an error state when the request fails", async () => {
    const dataLayer = makeDataLayer(async () => {
      throw new ApiError({ status: 500, statusText: "Server Error", data: {} });
    });
    const element = mount(dataLayer);
    await flushMicrotasks();

    assert(element.querySelector("[data-testid='trending-pane']") !== null);
    assert(element.querySelector("[data-testid='trending-error']") !== null);
    assert.deepEqual(
      element.querySelectorAll("[data-testid='trending-skeleton']").length,
      0,
    );
  });

  it("recovers from the error state when retry succeeds", async () => {
    let shouldFail = true;
    const dataLayer = makeDataLayer(async () => {
      if (shouldFail) {
        throw new ApiError({
          status: 500,
          statusText: "Server Error",
          data: {},
        });
      }
      return { trends: [createTrend({ topic: "gardening" })] };
    });
    const element = mount(dataLayer);
    await flushMicrotasks();
    assert(element.querySelector("[data-testid='trending-error']") !== null);

    shouldFail = false;
    element.querySelector("[data-testid='trending-error'] button").click();
    await flushMicrotasks();

    assert.deepEqual(
      element.querySelector("[data-testid='trending-error']"),
      null,
    );
    assert.deepEqual(rowLabels(element), ["gardening"]);
  });

  it("returns to the error state when a retry also fails", async () => {
    const dataLayer = makeDataLayer(async () => {
      throw new ApiError({ status: 500, statusText: "Server Error", data: {} });
    });
    const element = mount(dataLayer);
    await flushMicrotasks();

    element.querySelector("[data-testid='trending-error'] button").click();
    await flushMicrotasks();

    assert(element.querySelector("[data-testid='trending-error']") !== null);
  });

  it("hides the pane after confirming the hide prompt", async () => {
    const dataLayer = makeDataLayer(async () => ({
      trends: [createTrend({ topic: "gardening" })],
    }));
    const element = mount(dataLayer);
    await flushMicrotasks();

    element.querySelector("[data-testid='trending-hide-button']").click();
    await respondToConfirm(true);
    await flushMicrotasks();

    assert(displayPreferences.$trendingHidden.get());
    assert.deepEqual(
      element.querySelector("[data-testid='trending-pane']"),
      null,
    );
  });
});
