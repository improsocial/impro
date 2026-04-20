class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }

  toString() {
    return `AssertionError: ${this.message}`;
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export function deepEqual(objA, objB) {
  if (objA instanceof Array) {
    return (
      objA.length === objB.length &&
      objA.every((value, index) => deepEqual(value, objB[index]))
    );
  }
  if (objA instanceof Object) {
    return Object.keys(objA).every((key) => deepEqual(objA[key], objB[key]));
  }
  return objA === objB;
}

function prettyPrint(value) {
  if (value instanceof Array || value instanceof Object) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function assertEquals(actual, expected) {
  if (!deepEqual(actual, expected)) {
    throw new AssertionError(`assertEquals failed: 
      expected: ${prettyPrint(expected)}
      actual: ${prettyPrint(actual)}
    `);
  }
}

// Equivalent to jest.fn()
export function mock(fn = () => {}) {
  const calls = [];
  const results = [];
  const mockFn = (...args) => {
    calls.push(args);
    const result = fn(...args);
    results.push(result);
    return result;
  };
  mockFn.calls = calls;
  mockFn.results = results;
  return mockFn;
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
