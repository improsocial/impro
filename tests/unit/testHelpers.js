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
