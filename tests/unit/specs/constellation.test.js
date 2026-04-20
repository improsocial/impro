import { TestSuite } from "../testSuite.js";
import { assert, assertEquals, MockFetch } from "../testHelpers.js";
import { Constellation } from "/js/constellation.js";

const t = new TestSuite("Constellation");

const getLinks = (options) => new Constellation().getLinks(options);

const BACKLINKS_URL =
  "https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks";

function jsonResponse(body) {
  return { ok: true, json: async () => body };
}

function parseQuery(url) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

t.beforeEach(() => {
  globalThis.fetch = new MockFetch();
});

t.afterEach(() => {
  delete globalThis.fetch;
});

t.describe("getLinks", (it) => {
  it("should build URL targeting the constellation backlinks endpoint", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    await getLinks({
      subject: "at://did:plc:author/app.bsky.feed.post/abc",
      source: "app.bsky.feed.like",
    });

    assertEquals(globalThis.fetch.calls.length, 1);
    assert(globalThis.fetch.calls[0].url.startsWith(`${BACKLINKS_URL}?`));
  });

  it("should include subject, source, and a fixed limit of 100 in the query", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    await getLinks({
      subject: "at://did:plc:author/app.bsky.feed.post/abc",
      source: "app.bsky.feed.like",
    });

    const query = parseQuery(globalThis.fetch.calls[0].url);
    assertEquals(query.subject, "at://did:plc:author/app.bsky.feed.post/abc");
    assertEquals(query.source, "app.bsky.feed.like");
    assertEquals(query.limit, "100");
    assert(query.cursor === undefined);
  });

  it("should send Accept: application/json header", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    await getLinks({ subject: "subj", source: "src" });

    assertEquals(
      globalThis.fetch.calls[0].options.headers.Accept,
      "application/json",
    );
  });

  it("should return all records from a single page when no cursor is returned", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [{ uri: "a" }, { uri: "b" }, { uri: "c" }],
      cursor: null,
    });

    const links = await getLinks({ subject: "subj", source: "src" });

    assertEquals(links.length, 3);
    assertEquals(links[0].uri, "a");
    assertEquals(links[2].uri, "c");
  });

  it("should paginate across pages using the returned cursor", async () => {
    const pages = [
      { records: [{ uri: "a" }, { uri: "b" }], cursor: "cursor1" },
      { records: [{ uri: "c" }, { uri: "d" }], cursor: "cursor2" },
      { records: [{ uri: "e" }], cursor: null },
    ];
    let pageIndex = 0;
    globalThis.fetch.__intercept(BACKLINKS_URL, async () =>
      jsonResponse(pages[pageIndex++]),
    );

    const links = await getLinks({ subject: "subj", source: "src" });

    const receivedCursors = globalThis.fetch.calls.map(
      (call) => parseQuery(call.url).cursor,
    );
    assertEquals(pageIndex, 3);
    assertEquals(receivedCursors, [undefined, "cursor1", "cursor2"]);
    assertEquals(links.length, 5);
    assertEquals(
      links.map((link) => link.uri),
      ["a", "b", "c", "d", "e"],
    );
  });

  it("should stop paginating and slice results once the limit is reached", async () => {
    const pages = [
      { records: [{ uri: "a" }, { uri: "b" }], cursor: "cursor1" },
      { records: [{ uri: "c" }, { uri: "d" }], cursor: "cursor2" },
      { records: [{ uri: "e" }, { uri: "f" }], cursor: "cursor3" },
    ];
    let pageIndex = 0;
    globalThis.fetch.__intercept(BACKLINKS_URL, async () =>
      jsonResponse(pages[pageIndex++]),
    );

    const links = await getLinks({
      subject: "subj",
      source: "src",
      limit: 3,
    });

    assertEquals(links.length, 3);
    assertEquals(
      links.map((link) => link.uri),
      ["a", "b", "c"],
    );
    assert(
      globalThis.fetch.calls.length <= 2,
      "should not fetch more pages than needed",
    );
  });

  it("should return an empty array when the first page has no records and no cursor", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    const links = await getLinks({ subject: "subj", source: "src" });

    assertEquals(links, []);
  });

  it("should pass an AbortSignal to fetch so the request can be cancelled on timeout", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    await getLinks({ subject: "subj", source: "src", timeout: 5000 });

    const { signal } = globalThis.fetch.calls[0].options;
    assert(signal instanceof AbortSignal);
    assertEquals(signal.aborted, false);
  });

  it("should abort in-flight requests once the timeout elapses", async () => {
    globalThis.fetch.__intercept(
      BACKLINKS_URL,
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    );

    let thrownError = null;
    try {
      await getLinks({ subject: "subj", source: "src", timeout: 10 });
    } catch (error) {
      thrownError = error;
    }

    assert(thrownError !== null);
    assertEquals(thrownError.name, "AbortError");
    assertEquals(globalThis.fetch.calls[0].options.signal.aborted, true);
  });

  it("should not wire up an abort timer when timeout is 0", async () => {
    globalThis.fetch.__interceptJson(BACKLINKS_URL, {
      records: [],
      cursor: null,
    });

    await getLinks({ subject: "subj", source: "src", timeout: 0 });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assertEquals(globalThis.fetch.calls[0].options.signal.aborted, false);
  });

  it("should throw on unmatched routes so tests fail loudly", async () => {
    globalThis.fetch.__interceptJson("https://example.invalid/", {});

    let thrownError = null;
    try {
      await getLinks({ subject: "subj", source: "src" });
    } catch (error) {
      thrownError = error;
    }

    assert(thrownError !== null);
    assert(thrownError.message.includes("Unhandled fetch"));
  });
});

await t.run();
