import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { makePluginRequest } from "/js/plugins/pluginRequests.js";

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

const t = new TestSuite("makePluginRequest");

t.describe("allowlist - scheme", (it) => {
  it("rejects http URLs even if pattern matches host", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
        makePlugin(["https://example.com/*"]),
        "http://example.com/foo",
        {},
        fakeFetch,
      ),
    );
    assertEquals(calls.length, 0);
  });

  it("rejects http patterns even with https URL", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
        makePlugin(["http://example.com/*"]),
        "https://example.com/x",
        {},
        fakeFetch,
      ),
    );
  });
});

t.describe("allowlist - host matching", (it) => {
  it("allows exact host + path match", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://example.com/things"]),
      "https://example.com/things",
      {},
      fakeFetch,
    );
    assertEquals(calls.length, 1);
  });

  it("rejects a different host", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
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
      makePluginRequest(
        makePlugin(["https://example.com/*"]),
        "https://api.example.com/things",
        {},
        fakeFetch,
      ),
    );
  });

  it("is case-insensitive on host", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://example.com/things"]),
      "https://Example.COM/things",
      {},
      fakeFetch,
    );
    assertEquals(calls.length, 1);
  });

  it("matches *.host on the bare domain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://*.example.com/*"]),
      "https://example.com/foo",
      {},
      fakeFetch,
    );
    assertEquals(calls.length, 1);
  });

  it("matches *.host on a subdomain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://*.example.com/*"]),
      "https://api.example.com/foo",
      {},
      fakeFetch,
    );
    assertEquals(calls.length, 1);
  });

  it("does not match an unrelated suffix that happens to end in the domain", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
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
      makePluginRequest(
        makePlugin(["https://example.com/*"]),
        "https://example.com@evil.com/x",
        {},
        fakeFetch,
      ),
    );
  });
});

t.describe("allowlist - path matching", (it) => {
  it("matches by prefix when path ends with *", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://example.com/v1/*"]),
      "https://example.com/v1/items/42",
      {},
      fakeFetch,
    );
    assertEquals(calls.length, 1);
  });

  it("requires exact path when no trailing *", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
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
      makePluginRequest(
        { pluginId: "demo", permissions: {} },
        "https://api.example.com/x",
        {},
        fakeFetch,
      ),
    );
    assertEquals(calls.length, 0);
  });
});

t.describe("safe fetch options", (it) => {
  it("forces credentials=omit and redirect=error", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assertEquals(calls[0].init.credentials, "omit");
    assertEquals(calls[0].init.redirect, "error");
    assertEquals(calls[0].init.referrerPolicy, "no-referrer");
  });

  it("defaults method to GET", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assertEquals(calls[0].init.method, "GET");
  });

  it("passes through allowed methods uppercased", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { method: "post" },
      fakeFetch,
    );
    assertEquals(calls[0].init.method, "POST");
  });

  it("rejects disallowed methods", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(
      () =>
        makePluginRequest(
          makePlugin(["https://api.example.com/*"]),
          "https://api.example.com/x",
          { method: "CONNECT" },
          fakeFetch,
        ),
      "method",
    );
    assertEquals(calls.length, 0);
  });
});

t.describe("header handling", (it) => {
  it("forwards allowed headers", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { headers: { "X-Custom": "v" } },
      fakeFetch,
    );
    assertEquals(calls[0].init.headers["X-Custom"], "v");
  });

  it("rejects forbidden headers (any casing)", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(
      () =>
        makePluginRequest(
          makePlugin(["https://api.example.com/*"]),
          "https://api.example.com/x",
          { headers: { Cookie: "session=abc" } },
          fakeFetch,
        ),
      "header",
    );
    assertEquals(calls.length, 0);
  });
});

t.describe("body handling", (it) => {
  it("forwards a string body", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      { method: "POST", body: '{"a":1}' },
      fakeFetch,
    );
    assertEquals(calls[0].init.body, '{"a":1}');
  });

  it("rejects non-string body", async () => {
    const { fakeFetch } = makeFakeFetch();
    await expectRejection(() =>
      makePluginRequest(
        makePlugin(["https://api.example.com/*"]),
        "https://api.example.com/x",
        { method: "POST", body: { a: 1 } },
        fakeFetch,
      ),
    );
  });
});

t.describe("response shape", (it) => {
  it("returns picked headers only", async () => {
    const { fakeFetch } = makeFakeFetch({
      headers: { "content-type": "application/json", "set-cookie": "x=1" },
      body: '{"a":1}',
    });
    const result = await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assertEquals(result.headers["content-type"], "application/json");
    assert(result.headers["set-cookie"] === undefined);
  });

  it("exposes status and ok", async () => {
    const { fakeFetch } = makeFakeFetch({ status: 404, body: "nope" });
    const result = await makePluginRequest(
      makePlugin(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assertEquals(result.status, 404);
    assertEquals(result.ok, false);
    assertEquals(result.body, "nope");
  });
});

await t.run();
