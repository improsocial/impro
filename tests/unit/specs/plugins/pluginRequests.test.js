import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pluginFetch } from "/js/plugins/pluginRequests.js";

function makePlugin(patterns) {
  return { pluginId: "demo", permissions: { fetch: patterns } };
}

function makeFakeFetch({ status = 200, body = "", headers = {} } = {}) {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (name) => headers[name.toLowerCase()] ?? null,
      },
      text: async () => body,
    };
  };
  return { fakeFetch, calls };
}

async function expectRejection(fn, includes) {
  let threw = false;
  try {
    await fn();
  } catch (error) {
    threw = true;
    if (includes) {
      assert(
        error.message.toLowerCase().includes(includes.toLowerCase()),
        `expected error to include "${includes}", got "${error.message}"`,
      );
    }
  }
  assert(threw, "expected promise to reject");
}

describe("allowlist - scheme", () => {
  it("rejects http URLs even if pattern matches host", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://example.com/*"]),
        "http://example.com/foo",
        {},
        fakeFetch,
      ),
    );
    assert.deepEqual(calls.length, 0);
  });

  it("rejects http patterns even with https URL", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["http://example.com/*"]),
        "https://example.com/x",
        {},
        fakeFetch,
      ),
    );
  });
});

describe("allowlist - host matching", () => {
  it("allows exact host + path match", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://example.com/things"]),
      "https://example.com/things",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("rejects a different host", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://example.com/things"]),
        "https://evil.com/things",
        {},
        fakeFetch,
      ),
    );
  });

  it("rejects a subdomain when pattern has no wildcard", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://example.com/*"]),
        "https://api.example.com/things",
        {},
        fakeFetch,
      ),
    );
  });

  it("is case-insensitive on host", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://example.com/things"]),
      "https://Example.COM/things",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("matches *.host on the bare domain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://*.example.com/*"]),
      "https://example.com/foo",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("matches *.host on a subdomain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://*.example.com/*"]),
      "https://api.example.com/foo",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("does not match an unrelated suffix that happens to end in the domain", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://*.example.com/*"]),
        "https://notexample.com/foo",
        {},
        fakeFetch,
      ),
    );
  });

  it("is not fooled by userinfo confusion", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://example.com/*"]),
        "https://example.com@evil.com/x",
        {},
        fakeFetch,
      ),
    );
  });
});

describe("allowlist - path matching", () => {
  it("matches by prefix when path ends with *", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://example.com/v1/*"]),
      "https://example.com/v1/items/42",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("requires exact path when no trailing *", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://example.com/v1"]),
        "https://example.com/v1/items",
        {},
        fakeFetch,
      ),
    );
  });

  it("rejects when plugin has no fetch permissions", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        { pluginId: "demo", permissions: {} },
        "https://api.example.com/x",
        {},
        fakeFetch,
      ),
    );
    assert.deepEqual(calls.length, 0);
  });
});

describe("safe fetch options", () => {
  it("forces credentials=omit and redirect=error", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.credentials, "omit");
    assert.deepEqual(calls[0].init.redirect, "error");
    assert.deepEqual(calls[0].init.referrerPolicy, "no-referrer");
  });

  it("defaults method to GET", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.method, "GET");
  });

  it("passes through allowed methods uppercased", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { method: "post" },
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.method, "POST");
  });

  it("rejects disallowed methods", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(
      () =>
        pluginFetch(
          makePlugin(["https://api.example.com/*"]),
          "https://api.example.com/x",
          { method: "CONNECT" },
          fakeFetch,
        ),
      "method",
    );
    assert.deepEqual(calls.length, 0);
  });
});

describe("header handling", () => {
  it("forwards allowed headers", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { headers: { "X-Custom": "v" } },
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.headers["X-Custom"], "v");
  });

  it("rejects forbidden headers (any casing)", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(
      () =>
        pluginFetch(
          makePlugin(["https://api.example.com/*"]),
          "https://api.example.com/x",
          { headers: { Cookie: "session=abc" } },
          fakeFetch,
        ),
      "header",
    );
    assert.deepEqual(calls.length, 0);
  });
});

describe("body handling", () => {
  it("forwards a string body", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { method: "POST", body: '{"a":1}' },
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.body, '{"a":1}');
  });

  it("rejects non-string body", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        makePlugin(["https://api.example.com/*"]),
        "https://api.example.com/x",
        { method: "POST", body: { a: 1 } },
        fakeFetch,
      ),
    );
  });
});

describe("response shape", () => {
  it("returns picked headers only", async () => {
    const { fakeFetch } = makeFakeFetch({
      headers: { "content-type": "application/json", "set-cookie": "x=1" },
      body: '{"a":1}',
    });
    const result = await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(result.headers["content-type"], "application/json");
    assert(result.headers["set-cookie"] === undefined);
  });

  it("exposes status and ok", async () => {
    const { fakeFetch } = makeFakeFetch({ status: 404, body: "nope" });
    const result = await pluginFetch(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(result.status, 404);
    assert.deepEqual(result.ok, false);
    assert.deepEqual(result.body, "nope");
  });
});
