import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePermissions,
  diffPermissions,
  isEmptyPermissions,
  isFetchAllowed,
  isActionAllowed,
  isNetworkAllowed,
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

  it("parses the customEndpoint network scope and drops unknown ones", () => {
    assert.deepEqual(
      parsePermissions({ network: ["customEndpoint", "anyHost"] }),
      { network: ["customEndpoint"] },
    );
  });

  it("wraps a string network value into an array", () => {
    assert.deepEqual(parsePermissions({ network: "customEndpoint" }), {
      network: ["customEndpoint"],
    });
  });

  it("omits the network key when no valid scopes remain", () => {
    assert.deepEqual(parsePermissions({ network: [] }), {});
    assert.deepEqual(parsePermissions({ network: ["anyHost"] }), {});
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

describe("isNetworkAllowed", () => {
  it("allows only granted network scopes", () => {
    assert(isNetworkAllowed("customEndpoint", { network: ["customEndpoint"] }));
    assert(!isNetworkAllowed("customEndpoint", {}));
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

  it("denies everything when the fetch key is missing", () => {
    assert(!isFetchAllowed("https://example.com/", {}));
  });
});
