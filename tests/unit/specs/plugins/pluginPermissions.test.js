import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePermissions,
  diffPermissions,
  isEmptyPermissions,
  isFetchAllowed,
  isActionAllowed,
  isUserFetchAllowed,
  normalizeFetchOrigin,
  parseUserGrantedFetchOrigins,
} from "/js/plugins/pluginPermissions.js";

describe("parsePermissions", () => {
  it("returns an empty object when fetch is missing", () => {
    assert.deepEqual(parsePermissions({}), {});
  });

  it("omits the fetch key when no valid patterns remain", () => {
    assert.deepEqual(parsePermissions({ fetch: [] }), {});
    assert.deepEqual(parsePermissions({ fetch: [42, null] }), {});
  });

  it("wraps a string fetch value into an array", () => {
    assert.deepEqual(parsePermissions({ fetch: "https://x.com/*" }), {
      fetch: ["https://x.com/*"],
    });
  });

  it("filters non-string entries from fetch", () => {
    assert.deepEqual(
      parsePermissions({
        fetch: ["https://a.com/*", 42, null, "https://b.com/*"],
      }),
      { fetch: ["https://a.com/*", "https://b.com/*"] },
    );
  });

  it("dedupes fetch entries", () => {
    assert.deepEqual(
      parsePermissions({
        fetch: ["https://a.com/*", "https://b.com/*", "https://a.com/*"],
      }),
      { fetch: ["https://a.com/*", "https://b.com/*"] },
    );
  });

  it("parses known action scopes and drops unknown ones", () => {
    assert.deepEqual(
      parsePermissions({
        actions: ["mute", "block", "feedFeedback", "deleteEverything"],
      }),
      { actions: ["mute", "block", "feedFeedback"] },
    );
  });

  it("wraps a string actions value into an array", () => {
    assert.deepEqual(parsePermissions({ actions: "mute" }), {
      actions: ["mute"],
    });
  });

  it("omits the actions key when no valid scopes remain", () => {
    assert.deepEqual(parsePermissions({ actions: [] }), {});
    assert.deepEqual(parsePermissions({ actions: ["feedback"] }), {});
  });
});

describe("isActionAllowed", () => {
  it("allows only granted action scopes", () => {
    const permissions = { actions: ["mute", "feedFeedback"] };
    assert(isActionAllowed("mute", permissions));
    assert(isActionAllowed("feedFeedback", permissions));
    assert(!isActionAllowed("block", permissions));
  });

  it("denies everything when the actions key is missing", () => {
    assert(!isActionAllowed("mute", {}));
  });
});

describe("diffPermissions", () => {
  it("returns null when there are no new permissions", () => {
    assert.deepEqual(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });

  it("returns null when incoming is a subset of stored", () => {
    assert.deepEqual(
      diffPermissions(
        { fetch: ["https://a.com/*", "https://b.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });

  it("returns only the newly-added fetch patterns", () => {
    assert.deepEqual(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        {
          fetch: ["https://a.com/*", "https://b.com/*", "https://c.com/*"],
        },
      ),
      { fetch: ["https://b.com/*", "https://c.com/*"] },
    );
  });

  it("treats an empty stored set as 'everything new'", () => {
    assert.deepEqual(
      diffPermissions({ fetch: [] }, { fetch: ["https://a.com/*"] }),
      { fetch: ["https://a.com/*"] },
    );
  });

  it("treats a missing stored key the same as an empty array", () => {
    assert.deepEqual(diffPermissions({}, { fetch: ["https://a.com/*"] }), {
      fetch: ["https://a.com/*"],
    });
  });

  it("returns null when next has no keys", () => {
    assert.deepEqual(diffPermissions({ fetch: ["https://a.com/*"] }, {}), null);
  });

  it("omits keys from the diff when no additions for that key", () => {
    assert.deepEqual(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });
});

describe("diffPermissions (boolean scopes)", () => {
  it("reports a newly declared userFetch", () => {
    assert.deepEqual(diffPermissions({}, { userFetch: true }), {
      userFetch: true,
    });
  });

  it("does not report a userFetch that was already granted", () => {
    assert.equal(
      diffPermissions({ userFetch: true }, { userFetch: true }),
      null,
    );
  });

  it("diffs patterns alongside a boolean scope", () => {
    assert.deepEqual(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        { fetch: ["https://a.com/*", "https://b.com/*"], userFetch: true },
      ),
      { fetch: ["https://b.com/*"], userFetch: true },
    );
  });

  it("survives a stored value whose shape doesn't match the manifest", () => {
    assert.deepEqual(
      diffPermissions({ fetch: true }, { fetch: ["https://a.com/*"] }),
      { fetch: ["https://a.com/*"] },
    );
  });
});

describe("isEmptyPermissions (missing-key shape)", () => {
  it("returns true for an empty object", () => {
    assert(isEmptyPermissions({}));
  });
});

describe("isEmptyPermissions", () => {
  it("returns true for an all-empty object", () => {
    assert(isEmptyPermissions({ fetch: [] }));
  });

  it("returns false when any array is non-empty", () => {
    assert(!isEmptyPermissions({ fetch: ["https://a.com/*"] }));
  });

  // Load-bearing: this is what keeps a prompting plugin out of preview
  // installs, and userFetch is a boolean rather than an array.
  it("returns false for a userFetch grant", () => {
    assert(!isEmptyPermissions({ userFetch: true }));
  });

  it("returns true for a falsy userFetch", () => {
    assert(isEmptyPermissions({ userFetch: false }));
  });
});

describe("parsePermissions (userFetch)", () => {
  it("keeps a literal true", () => {
    assert.deepEqual(parsePermissions({ userFetch: true }), {
      userFetch: true,
    });
  });

  it("drops truthy non-boolean values", () => {
    assert.deepEqual(parsePermissions({ userFetch: "yes" }), {});
    assert.deepEqual(parsePermissions({ userFetch: 1 }), {});
    assert.deepEqual(parsePermissions({ userFetch: false }), {});
  });
});

describe("isUserFetchAllowed", () => {
  it("requires the parsed flag", () => {
    assert(isUserFetchAllowed({ userFetch: true }));
    assert(!isUserFetchAllowed({}));
    assert(!isUserFetchAllowed({ fetch: ["https://a.com/*"] }));
  });
});

describe("parseUserGrantedFetchOrigins", () => {
  it("normalizes and de-duplicates stored origins", () => {
    assert.deepEqual(
      parseUserGrantedFetchOrigins([
        "https://api.example.com/v1",
        "https://api.example.com/v2",
        "http://localhost:11434/api",
      ]),
      ["https://api.example.com/*", "http://localhost:11434/*"],
    );
  });

  // The preferences record is writable by anything holding the account's
  // credentials, so stored values are untrusted input
  it("drops anything that isn't a normalizable origin", () => {
    assert.deepEqual(
      parseUserGrantedFetchOrigins([
        "https://*/*",
        "http://evil.example.com/*",
        "not a url",
        42,
        null,
      ]),
      [],
    );
  });

  it("returns an empty array for a non-array value", () => {
    assert.deepEqual(parseUserGrantedFetchOrigins(undefined), []);
    assert.deepEqual(parseUserGrantedFetchOrigins("https://a.com/*"), []);
    assert.deepEqual(parseUserGrantedFetchOrigins(null), []);
  });
});

describe("normalizeFetchOrigin", () => {
  it("discards the path and keeps the origin", () => {
    assert.equal(
      normalizeFetchOrigin("https://api.example.com/v1/chat?key=1#x"),
      "https://api.example.com/*",
    );
  });

  it("preserves an explicit port", () => {
    assert.equal(
      normalizeFetchOrigin("http://localhost:11434/api/generate"),
      "http://localhost:11434/*",
    );
  });

  it("drops a default port, matching URL normalization", () => {
    assert.equal(
      normalizeFetchOrigin("https://example.com:443/foo"),
      "https://example.com/*",
    );
  });

  it("lowercases the host", () => {
    assert.equal(
      normalizeFetchOrigin("https://API.Example.COM/foo"),
      "https://api.example.com/*",
    );
  });

  it("allows http only for loopback", () => {
    assert.equal(
      normalizeFetchOrigin("http://127.0.0.1:8080/"),
      "http://127.0.0.1:8080/*",
    );
    assert.equal(
      normalizeFetchOrigin("http://[::1]:8080/"),
      "http://[::1]:8080/*",
    );
    assert.equal(normalizeFetchOrigin("http://example.com/"), null);
  });

  it("rejects embedded credentials", () => {
    assert.equal(normalizeFetchOrigin("https://user:pass@example.com/"), null);
    assert.equal(normalizeFetchOrigin("https://user@example.com/"), null);
  });

  it("rejects non-http(s) schemes", () => {
    assert.equal(normalizeFetchOrigin("ftp://example.com/"), null);
    assert.equal(normalizeFetchOrigin("javascript:alert(1)"), null);
    assert.equal(normalizeFetchOrigin("data:text/plain,hi"), null);
  });

  it("rejects unparseable input", () => {
    assert.equal(normalizeFetchOrigin("not a url"), null);
    assert.equal(normalizeFetchOrigin(""), null);
    assert.equal(normalizeFetchOrigin(null), null);
  });

  it("produces a pattern that isFetchAllowed accepts for that origin only", () => {
    const permissions = {
      fetch: [normalizeFetchOrigin("https://api.example.com/v1")],
    };
    assert(isFetchAllowed("https://api.example.com/other", permissions));
    assert(!isFetchAllowed("https://evil.example.com/", permissions));
    assert(!isFetchAllowed("http://api.example.com/", permissions));
  });
});

describe("isFetchAllowed", () => {
  it("matches any path when the pattern has no path component", () => {
    const permissions = { fetch: ["https://example.com"] };
    assert(isFetchAllowed("https://example.com/", permissions));
    assert(isFetchAllowed("https://example.com/foo", permissions));
    assert(isFetchAllowed("https://example.com/foo/bar", permissions));
  });

  it("still enforces the host when the pattern has no path", () => {
    const permissions = { fetch: ["https://example.com"] };
    assert(!isFetchAllowed("https://other.com/", permissions));
    assert(!isFetchAllowed("https://sub.example.com/", permissions));
  });

  it("supports wildcard hosts without a path component", () => {
    const permissions = { fetch: ["https://*.example.com"] };
    assert(isFetchAllowed("https://example.com/", permissions));
    assert(isFetchAllowed("https://a.example.com/foo", permissions));
    assert(!isFetchAllowed("https://other.com/", permissions));
  });

  it("treats a trailing * in the path as a prefix wildcard", () => {
    const permissions = { fetch: ["https://example.com/foobar*"] };
    assert(isFetchAllowed("https://example.com/foobar", permissions));
    assert(isFetchAllowed("https://example.com/foobarbaz", permissions));
    assert(isFetchAllowed("https://example.com/foobar/sub", permissions));
    assert(!isFetchAllowed("https://example.com/foo", permissions));
    assert(!isFetchAllowed("https://example.com/other", permissions));
  });

  it("rejects non-https urls", () => {
    const permissions = { fetch: ["https://example.com"] };
    assert(!isFetchAllowed("http://example.com/", permissions));
  });

  it("rejects http patterns for non-loopback hosts", () => {
    const permissions = { fetch: ["http://example.com/*"] };
    assert(!isFetchAllowed("http://example.com/", permissions));
  });

  it("allows http for loopback hosts", () => {
    const permissions = {
      fetch: [
        "http://localhost:11434/*",
        "http://127.0.0.1:1234/*",
        "http://[::1]:8080/*",
        "http://ollama.localhost/*",
      ],
    };
    assert(isFetchAllowed("http://localhost:11434/api/generate", permissions));
    assert(isFetchAllowed("http://127.0.0.1:1234/v1/chat", permissions));
    assert(isFetchAllowed("http://[::1]:8080/v1/chat", permissions));
    assert(isFetchAllowed("http://ollama.localhost/api", permissions));
  });

  it("does not let an https pattern authorize an http url", () => {
    const permissions = { fetch: ["https://localhost/*"] };
    assert(!isFetchAllowed("http://localhost/", permissions));
  });

  it("does not let an http loopback pattern authorize a remote host", () => {
    const permissions = { fetch: ["http://localhost/*"] };
    assert(!isFetchAllowed("http://localhost.evil.com/", permissions));
    assert(!isFetchAllowed("http://notlocalhost/", permissions));
  });

  it("enforces the port when the pattern specifies one", () => {
    const permissions = { fetch: ["http://localhost:11434/*"] };
    assert(!isFetchAllowed("http://localhost:1234/api", permissions));
    assert(!isFetchAllowed("http://localhost/api", permissions));
  });

  it("matches any port when the pattern omits one", () => {
    const permissions = { fetch: ["https://example.com/*"] };
    assert(isFetchAllowed("https://example.com/foo", permissions));
    assert(isFetchAllowed("https://example.com:8443/foo", permissions));
  });

  it("treats a default port in the url as matching an explicit pattern port", () => {
    const permissions = { fetch: ["https://example.com:443/*"] };
    assert(isFetchAllowed("https://example.com/foo", permissions));
  });

  it("denies everything when the fetch key is missing", () => {
    assert(!isFetchAllowed("https://example.com/", {}));
  });
});
