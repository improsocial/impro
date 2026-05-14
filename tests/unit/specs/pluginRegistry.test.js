import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PluginRegistry } from "/js/plugins/pluginRegistry.js";

function fakeFetcher(payloadsByUrl) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (!(url in payloadsByUrl)) return { ok: false, status: 404 };
    const payload = payloadsByUrl[url];
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      },
    };
  };
  return { fetchImpl, calls };
}

const REGISTRY_URL = "https://example.test/registry.json";
const LOCAL_INDEX_URL = "/plugins-local/index.json";

const SAMPLE = [
  {
    id: "alpha",
    name: "Alpha",
    author: "ow",
    description: "the first",
    repo: "ow/alpha",
  },
  {
    id: "beta",
    name: "Beta",
    author: "ow",
    description: "the second",
    repo: "ow/beta",
  },
];

const t = new TestSuite("pluginRegistry");

t.describe("PluginRegistry.getPluginListings", (it) => {
  it("combines local and remote listings with local marked", async () => {
    const { fetchImpl } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [
        { id: "gamma", name: "Gamma", author: "me", description: "local" },
      ],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    const listings = await registry.getPluginListings();
    assertEquals(listings.length, 3);
    assertEquals(listings[0], {
      id: "gamma",
      name: "Gamma",
      author: "me",
      description: "local",
      local: true,
    });
    assertEquals(listings[1].id, "alpha");
    assertEquals(listings[1].local, undefined);
  });

  it("local listings shadow remote listings with the same id", async () => {
    const { fetchImpl } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [
        { id: "alpha", name: "Alpha", author: "me", description: "local" },
      ],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    const listings = await registry.getPluginListings();
    assertEquals(listings.length, 2);
    const alpha = listings.find((listing) => listing.id === "alpha");
    assertEquals(alpha.local, true);
  });

  it("fetches and caches listings within TTL", async () => {
    const { fetchImpl, calls } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    await registry.getPluginListings();
    await registry.getPluginListings();
    const registryCalls = calls.filter((url) => url === REGISTRY_URL);
    assertEquals(registryCalls.length, 1);
  });

  it("force: true bypasses the cache", async () => {
    const { fetchImpl, calls } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    await registry.getPluginListings();
    await registry.getPluginListings({ force: true });
    const registryCalls = calls.filter((url) => url === REGISTRY_URL);
    assertEquals(registryCalls.length, 2);
  });

  it("tolerates a missing local index", async () => {
    const { fetchImpl } = fakeFetcher({ [REGISTRY_URL]: SAMPLE });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    const listings = await registry.getPluginListings();
    assertEquals(listings.length, 2);
    assert(listings.every((listing) => !listing.local));
  });
});

t.describe("PluginRegistry.getPluginListing", (it) => {
  it("returns the listing matching the id", async () => {
    const { fetchImpl } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    const listing = await registry.getPluginListing("beta");
    assertEquals(listing.repo, "ow/beta");
  });

  it("returns null when id is not in the registry", async () => {
    const { fetchImpl } = fakeFetcher({
      [REGISTRY_URL]: SAMPLE,
      [LOCAL_INDEX_URL]: [],
    });
    const registry = new PluginRegistry(REGISTRY_URL, { fetchImpl });
    assertEquals(await registry.getPluginListing("missing"), null);
  });
});

await t.run();
