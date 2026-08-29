import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PluginRequests,
  MAX_RESPONSE_BYTES,
} from "/js/plugins/pluginRequests.js";
import { ApiError } from "/js/api.js";
import { Permissions } from "/js/plugins/pluginPermissions.js";

function pluginFetch(permissions, url, init, fetchImpl) {
  return new PluginRequests({ fetchImpl }).pluginFetch(permissions, url, init);
}

function makePermissions(patterns) {
  return Permissions.parse({ fetch: patterns });
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
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
  };
  return { fakeFetch, calls };
}

// pluginFetch relays the response body as raw bytes so it can carry binary
// payloads, not just text - tests that care about the actual body content
// decode it back rather than comparing against a string.
function decodeBody(bodyBuffer) {
  return new TextDecoder().decode(bodyBuffer);
}

const queryTestPlugin = { pluginId: "test-plugin" };

function makeXrpcPluginRequests({
  request = async () => ({ status: 200, data: {} }),
  session = { did: "did:plc:me", handle: "me.test" },
  requireActionPermission = () => {},
} = {}) {
  const requestCalls = [];
  const permissionCalls = [];
  const dataLayer = {
    api: {
      appViewRequest: async (path, options) => {
        requestCalls.push({ path, options });
        return request(path, options);
      },
    },
  };
  const permissionsManager = {
    requireActionPermission: (plugin, action) => {
      permissionCalls.push({ plugin, action });
      return requireActionPermission(plugin, action);
    },
  };
  return {
    pluginRequests: new PluginRequests({
      dataLayer,
      session,
      permissionsManager,
    }),
    requestCalls,
    permissionCalls,
  };
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
        makePermissions(["https://example.com/*"]),
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
        makePermissions(["http://example.com/*"]),
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
      makePermissions(["https://example.com/things"]),
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
        makePermissions(["https://example.com/things"]),
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
        makePermissions(["https://example.com/*"]),
        "https://api.example.com/things",
        {},
        fakeFetch,
      ),
    );
  });

  it("is case-insensitive on host", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePermissions(["https://example.com/things"]),
      "https://Example.COM/things",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("matches *.host on the bare domain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePermissions(["https://*.example.com/*"]),
      "https://example.com/foo",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls.length, 1);
  });

  it("matches *.host on a subdomain", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePermissions(["https://*.example.com/*"]),
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
        makePermissions(["https://*.example.com/*"]),
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
        makePermissions(["https://example.com/*"]),
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
      makePermissions(["https://example.com/v1/*"]),
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
        makePermissions(["https://example.com/v1"]),
        "https://example.com/v1/items",
        {},
        fakeFetch,
      ),
    );
  });

  it("rejects when the granted permissions have no fetch patterns", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await expectRejection(() =>
      pluginFetch(
        Permissions.parse({}),
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
      makePermissions(["https://api.example.com/*"]),
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
      makePermissions(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(calls[0].init.method, "GET");
  });

  it("passes through allowed methods uppercased", async () => {
    const { fakeFetch, calls } = makeFakeFetch();
    await pluginFetch(
      makePermissions(["https://api.example.com/*"]),
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
          makePermissions(["https://api.example.com/*"]),
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
      makePermissions(["https://api.example.com/*"]),
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
          makePermissions(["https://api.example.com/*"]),
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
      makePermissions(["https://api.example.com/*"]),
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
        makePermissions(["https://api.example.com/*"]),
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
      makePermissions(["https://api.example.com/*"]),
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
      makePermissions(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert.deepEqual(result.status, 404);
    assert.deepEqual(result.ok, false);
    assert.deepEqual(decodeBody(result.body), "nope");
  });

  it("relays binary bytes intact", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe]);
    const fakeFetch = async () => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => bytes.buffer,
    });
    const result = await pluginFetch(
      makePermissions(["https://api.example.com/*"]),
      "https://api.example.com/x",
      {},
      fakeFetch,
    );
    assert(result.body instanceof ArrayBuffer);
    assert.deepEqual([...new Uint8Array(result.body)], [...bytes]);
  });
});

describe("response size", () => {
  it("rejects a response over the byte cap", async () => {
    // The cap check only reads .byteLength before any bytes are touched, so
    // this fakes an over-limit length without actually allocating that much
    // memory in the test.
    const fakeFetch = async () => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => ({ byteLength: MAX_RESPONSE_BYTES + 1 }),
    });
    await expectRejection(
      () =>
        pluginFetch(
          makePermissions(["https://api.example.com/*"]),
          "https://api.example.com/x",
          {},
          fakeFetch,
        ),
      "too large",
    );
  });
});

describe("pluginXrpcRequest", () => {
  const queryPlugin = { pluginId: "test-plugin" };

  it("rejects a query that is not allowlisted without making a request", async () => {
    const { pluginRequests, requestCalls } = makeXrpcPluginRequests();
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(
        queryPlugin,
        "chat.bsky.convo.getMessages",
        {},
      ),
      /not an allowed query/,
    );
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(
        queryPlugin,
        "com.atproto.repo.deleteRecord",
        {},
      ),
      /not an allowed query/,
    );
    assert.deepEqual(requestCalls, []);
  });

  it("performs an allowlisted public query with params, without a permission check", async () => {
    const data = { posts: [{ uri: "at://quote/1" }] };
    const { pluginRequests, requestCalls, permissionCalls } =
      makeXrpcPluginRequests({
        request: async () => ({ status: 200, data }),
      });
    const result = await pluginRequests.pluginXrpcRequest(
      queryPlugin,
      "app.bsky.feed.getQuotes",
      { uri: "at://example/post/1", limit: 25 },
    );
    assert.deepEqual(result, { ok: true, status: 200, data });
    assert.deepEqual(requestCalls.length, 1);
    assert.deepEqual(requestCalls[0].path, "app.bsky.feed.getQuotes");
    assert.deepEqual(requestCalls[0].options.query, {
      uri: "at://example/post/1",
      limit: 25,
    });
    assert.deepEqual(permissionCalls, []);
  });

  it("requires the privateData permission for private queries", async () => {
    const { pluginRequests, requestCalls, permissionCalls } =
      makeXrpcPluginRequests({
        requireActionPermission: () => {
          throw new Error(
            '"test-plugin" does not have "privateData" action permission',
          );
        },
      });
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(
        queryPlugin,
        "app.bsky.graph.getMutes",
        {},
      ),
      /"privateData" action permission/,
    );
    assert.deepEqual(permissionCalls, [
      { plugin: queryPlugin, action: "privateData" },
    ]);
    assert.deepEqual(requestCalls, []);
  });

  it("performs a private query when the permission is granted", async () => {
    const data = { mutes: [] };
    const { pluginRequests, requestCalls, permissionCalls } =
      makeXrpcPluginRequests({
        request: async () => ({ status: 200, data }),
      });
    const result = await pluginRequests.pluginXrpcRequest(
      queryPlugin,
      "app.bsky.graph.getMutes",
      {},
    );
    assert.deepEqual(result, { ok: true, status: 200, data });
    assert.deepEqual(permissionCalls, [
      { plugin: queryPlugin, action: "privateData" },
    ]);
    assert.deepEqual(requestCalls.length, 1);
  });

  it("rejects private queries when signed out", async () => {
    const { pluginRequests, requestCalls, permissionCalls } =
      makeXrpcPluginRequests({ session: null });
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(
        queryPlugin,
        "app.bsky.graph.getMutes",
        {},
      ),
      /Not signed in/,
    );
    assert.deepEqual(permissionCalls, []);
    assert.deepEqual(requestCalls, []);
  });

  it("returns ok:false with the error body on an ApiError", async () => {
    const { pluginRequests } = makeXrpcPluginRequests({
      request: async () => {
        throw new ApiError({
          status: 400,
          statusText: "Bad Request",
          data: { error: "InvalidRequest", message: "bad uri" },
          headers: null,
          url: "",
        });
      },
    });
    const result = await pluginRequests.pluginXrpcRequest(
      queryPlugin,
      "app.bsky.feed.getQuotes",
      { uri: "nope" },
    );
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      data: { error: "InvalidRequest", message: "bad uri" },
    });
  });

  it("rejects with a sanitized error on non-API failures", async () => {
    const { pluginRequests } = makeXrpcPluginRequests({
      request: async () => {
        throw new TypeError("secret internal detail");
      },
    });
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(
        queryPlugin,
        "app.bsky.feed.getQuotes",
        {},
      ),
      (error) => {
        assert(!error.message.includes("secret internal detail"));
        assert(
          /request to "app\.bsky\.feed\.getQuotes" failed/.test(error.message),
        );
        return true;
      },
    );
  });

  it("rejects unsupported param values before making a request", async () => {
    const { pluginRequests, requestCalls } = makeXrpcPluginRequests();
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryPlugin, "app.bsky.feed.getQuotes", {
        uri: { toString: () => "sneaky" },
      }),
      /unsupported type/,
    );
    assert.deepEqual(requestCalls, []);
  });
});

describe("xrpc query allowlist (via pluginXrpcRequest)", () => {
  it("classifies public queries as callable without a permission check", async () => {
    for (const nsid of [
      "app.bsky.feed.getQuotes",
      "app.bsky.graph.getLists",
      "app.bsky.actor.getProfile",
    ]) {
      const { pluginRequests, requestCalls, permissionCalls } =
        makeXrpcPluginRequests();
      await pluginRequests.pluginXrpcRequest(queryTestPlugin, nsid, {});
      assert.deepEqual(requestCalls.length, 1, nsid);
      assert.deepEqual(permissionCalls, [], nsid);
    }
  });

  it("classifies private queries as permission-gated", async () => {
    for (const nsid of [
      "app.bsky.graph.getMutes",
      "app.bsky.notification.listNotifications",
      "app.bsky.feed.getTimeline",
    ]) {
      const { pluginRequests, requestCalls, permissionCalls } =
        makeXrpcPluginRequests();
      await pluginRequests.pluginXrpcRequest(queryTestPlugin, nsid, {});
      assert.deepEqual(requestCalls.length, 1, nsid);
      assert.deepEqual(
        permissionCalls,
        [{ plugin: queryTestPlugin, action: "privateData" }],
        nsid,
      );
    }
  });

  it("refuses everything not allowlisted", async () => {
    for (const nsid of [
      "chat.bsky.convo.getMessages",
      "chat.bsky.convo.listConvos",
      "app.bsky.draft.getDrafts",
      "com.atproto.repo.createRecord",
      "app.bsky.feed.sendInteractions",
      // Would let the AppView forward the user's service auth to a
      // plugin-chosen feed generator
      "app.bsky.feed.getFeed",
      "",
    ]) {
      const { pluginRequests, requestCalls } = makeXrpcPluginRequests();
      await assert.rejects(
        pluginRequests.pluginXrpcRequest(queryTestPlugin, nsid, {}),
        /not an allowed query/,
        nsid,
      );
      assert.deepEqual(requestCalls, [], nsid);
    }
  });
});

describe("xrpc param sanitization (via pluginXrpcRequest)", () => {
  const NSID = "app.bsky.feed.getQuotes";

  async function queryWith(params) {
    const { pluginRequests, requestCalls } = makeXrpcPluginRequests();
    await pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, params);
    return requestCalls[0].options.query;
  }

  it("passes through scalar and string-array values", async () => {
    assert.deepEqual(
      await queryWith({
        uri: "at://example/post/1",
        limit: 25,
        includePins: true,
        uris: ["at://a", "at://b"],
      }),
      {
        uri: "at://example/post/1",
        limit: 25,
        includePins: true,
        uris: ["at://a", "at://b"],
      },
    );
  });

  it("sends an empty query for missing params", async () => {
    assert.deepEqual(await queryWith(null), {});
    assert.deepEqual(await queryWith(undefined), {});
  });

  it("drops null and undefined values", async () => {
    assert.deepEqual(await queryWith({ cursor: null, limit: 5 }), { limit: 5 });
  });

  it("rejects non-object params", async () => {
    const { pluginRequests, requestCalls } = makeXrpcPluginRequests();
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, "uri=x"),
      /must be an object/,
    );
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, ["uri"]),
      /must be an object/,
    );
    assert.deepEqual(requestCalls, []);
  });

  it("rejects object and function values", async () => {
    const { pluginRequests } = makeXrpcPluginRequests();
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, {
        uri: { toString: () => "x" },
      }),
      /unsupported type/,
    );
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, {
        uris: [() => "x"],
      }),
      /unsupported type/,
    );
  });

  it("rejects oversized values", async () => {
    const { pluginRequests } = makeXrpcPluginRequests();
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, {
        q: "x".repeat(2001),
      }),
      /too long/,
    );
    const tooMany = Object.fromEntries(
      Array.from({ length: 21 }, (_, index) => [`p${index}`, "x"]),
    );
    await assert.rejects(
      pluginRequests.pluginXrpcRequest(queryTestPlugin, NSID, tooMany),
      /too many params/,
    );
  });
});
