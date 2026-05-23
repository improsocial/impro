import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  parsePermissions,
  diffPermissions,
  isEmptyPermissions,
  isFetchAllowed,
} from "/js/plugins/pluginPermissions.js";

const t = new TestSuite("pluginPermissions");

t.describe("parsePermissions", (it) => {
  it("returns an empty object when fetch is missing", () => {
    assertEquals(parsePermissions({}), {});
  });

  it("omits the fetch key when no valid patterns remain", () => {
    assertEquals(parsePermissions({ fetch: [] }), {});
    assertEquals(parsePermissions({ fetch: [42, null] }), {});
  });

  it("wraps a string fetch value into an array", () => {
    assertEquals(parsePermissions({ fetch: "https://x.com/*" }), {
      fetch: ["https://x.com/*"],
    });
  });

  it("filters non-string entries from fetch", () => {
    assertEquals(
      parsePermissions({
        fetch: ["https://a.com/*", 42, null, "https://b.com/*"],
      }),
      { fetch: ["https://a.com/*", "https://b.com/*"] },
    );
  });

  it("dedupes fetch entries", () => {
    assertEquals(
      parsePermissions({
        fetch: ["https://a.com/*", "https://b.com/*", "https://a.com/*"],
      }),
      { fetch: ["https://a.com/*", "https://b.com/*"] },
    );
  });
});

t.describe("diffPermissions", (it) => {
  it("returns null when there are no new permissions", () => {
    assertEquals(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });

  it("returns null when incoming is a subset of stored", () => {
    assertEquals(
      diffPermissions(
        { fetch: ["https://a.com/*", "https://b.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });

  it("returns only the newly-added fetch patterns", () => {
    assertEquals(
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
    assertEquals(
      diffPermissions({ fetch: [] }, { fetch: ["https://a.com/*"] }),
      { fetch: ["https://a.com/*"] },
    );
  });

  it("treats a missing stored key the same as an empty array", () => {
    assertEquals(diffPermissions({}, { fetch: ["https://a.com/*"] }), {
      fetch: ["https://a.com/*"],
    });
  });

  it("returns null when next has no keys", () => {
    assertEquals(diffPermissions({ fetch: ["https://a.com/*"] }, {}), null);
  });

  it("omits keys from the diff when no additions for that key", () => {
    assertEquals(
      diffPermissions(
        { fetch: ["https://a.com/*"] },
        { fetch: ["https://a.com/*"] },
      ),
      null,
    );
  });
});

t.describe("isEmptyPermissions (missing-key shape)", (it) => {
  it("returns true for an empty object", () => {
    assert(isEmptyPermissions({}));
  });
});

t.describe("isEmptyPermissions", (it) => {
  it("returns true for an all-empty object", () => {
    assert(isEmptyPermissions({ fetch: [] }));
  });

  it("returns false when any array is non-empty", () => {
    assert(!isEmptyPermissions({ fetch: ["https://a.com/*"] }));
  });
});

t.describe("isFetchAllowed", (it) => {
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

await t.run();
