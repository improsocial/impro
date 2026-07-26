import { mock } from "node:test";
import { DataLayer } from "/js/dataLayer/dataLayer.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { DraftMediaStore } from "/js/drafts.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";

export function makeTestDataLayer({
  api: apiOverrides = {},
  identityResolver,
  draftMediaStore,
  hiddenFeedItemsStore,
} = {}) {
  const api = {
    getProfile: async () => null,
    isAuthenticated: false,
    getPreferences: async () => [],
    getLabelers: async () => [],
    updatePreferences: async () => {},
    ...apiOverrides,
  };
  return new DataLayer(
    api,
    new PreferencesProvider(api),
    identityResolver ?? { resolveHandle: async () => null },
    draftMediaStore ?? new DraftMediaStore("test-media"),
    hiddenFeedItemsStore ?? new HiddenFeedItemsStore(),
  );
}

// Stubs the four declarative.ensure* record-resolution methods with plausible
// default fixtures. Pass overrides for methods a test needs to control.
export function stubRecordLinkResolution(dataLayer, overrides = {}) {
  const defaults = {
    ensureFeedGenerator: async (uri) => ({
      uri,
      cid: "feedcid",
      displayName: "Cool Feed",
      creator: { did: "did:plc:creator1", handle: "creator1.test" },
    }),
    ensureList: async (uri) => ({
      uri,
      cid: "listcid",
      name: "Cool List",
      creator: { did: "did:plc:creator1", handle: "creator1.test" },
    }),
    ensureStarterPack: async (uri) => ({
      $type: "app.bsky.graph.defs#starterPackView",
      uri,
      cid: "packcid",
      record: { name: "Cool Pack", description: "People to follow" },
      creator: { did: "did:plc:creator1", handle: "creator1.test" },
    }),
    ensurePost: async (uri) => ({
      uri,
      cid: "postcid",
      author: {
        did: "did:plc:creator1",
        handle: "creator1.test",
        displayName: "Creator One",
        avatar: null,
      },
      record: { text: "Original post", createdAt: "2025-01-01T00:00:00Z" },
      indexedAt: "2025-01-01T00:00:00.000Z",
      labels: [],
    }),
  };
  for (const [name, impl] of Object.entries({ ...defaults, ...overrides })) {
    mock.method(dataLayer.declarative, name, impl);
  }
}

// Replace a status-tracked loader on `requests` with a mock impl, keeping the
// real enableStatus wrapper so the statusStore populates like in production.
// Pre-handles rejections since some loaders are fired without awaiting;
// awaiters still observe the rejection.
export function stubStatusTracked(requests, methodName, requestIdOrFn, impl) {
  const spy = mock.fn(impl);
  Object.defineProperty(spy, "name", { value: methodName });
  requests.enableStatus(spy, requestIdOrFn);
  const wrapped = requests[methodName];
  requests[methodName] = (...args) => {
    const p = wrapped(...args);
    p.catch(() => {});
    return p;
  };
  return spy;
}

const originalWindow = globalThis.window;

// Replaces globalThis.window with a proxy that intercepts location.href writes
// so we can capture redirects without triggering JSDOM navigation errors.
// Returns the captured hrefs array. Call restoreWindow() to undo.
export function mockWindowLocation(search = "") {
  const capturedHrefs = [];
  const locationMock = {
    get search() {
      return search;
    },
    get pathname() {
      return "/";
    },
    get hash() {
      return "";
    },
    get href() {
      return capturedHrefs.at(-1) ?? "http://localhost/";
    },
    set href(value) {
      capturedHrefs.push(value);
    },
    assign(value) {
      capturedHrefs.push(value);
    },
    reload() {
      capturedHrefs.push("reload");
    },
  };
  globalThis.window = new Proxy(originalWindow, {
    get(target, prop) {
      if (prop === "location") return locationMock;
      const val = target[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
  return capturedHrefs;
}

export function restoreWindow() {
  globalThis.window = originalWindow;
}

export async function waitFor(predicate, { timeout = 2000 } = {}) {
  const deadline = Number(process.hrtime.bigint() / 1_000_000n) + timeout;
  while (!predicate()) {
    if (Number(process.hrtime.bigint() / 1_000_000n) > deadline) {
      throw new Error("waitFor timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function respondToConfirm(confirmed) {
  const testId = confirmed ? "modal-confirm-button" : "modal-cancel-button";
  await waitFor(() => document.querySelector(`[data-testid="${testId}"]`));
  document.querySelector(`[data-testid="${testId}"]`).click();
}

export async function chooseModal(value) {
  const testId = `modal-choice-${value}`;
  await waitFor(() => document.querySelector(`[data-testid="${testId}"]`));
  document.querySelector(`[data-testid="${testId}"]`).click();
}

// A callable fetch replacement. Assign to globalThis.fetch, register routes
// with __intercept(matcher, handler), and inspect captured requests on `calls`.
// Matchers are strings (matched by URL prefix) or regex (matched with .test).
export class MockFetch {
  constructor() {
    const routes = [];
    const calls = [];
    const fetch = async (url, options) => {
      calls.push({ url, options });
      for (const route of routes) {
        const matches =
          typeof route.matcher === "string"
            ? url.startsWith(route.matcher)
            : route.matcher.test(url);
        if (matches) {
          return route.handler(url, options);
        }
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };
    fetch.calls = calls;
    fetch.__intercept = (matcher, handler) => {
      routes.push({ matcher, handler });
      return fetch;
    };
    fetch.__interceptJson = (matcher, body) => {
      return fetch.__intercept(matcher, async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => null },
        json: async () => body,
        text: async () => "",
      }));
    };
    return fetch;
  }
}
