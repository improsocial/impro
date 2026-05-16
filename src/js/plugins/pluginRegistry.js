const CACHE_TTL_MS = 120_000;

class PluginRegistry {
  async getListings() {
    throw new Error("not implemented");
  }
  async getListing(id) {
    const listings = await this.getListings();
    return listings.find((listing) => listing.id === id) ?? null;
  }
}

export class RemotePluginRegistry extends PluginRegistry {
  constructor(url) {
    super();
    this.url = url;
    this._cache = null;
  }

  async getListings() {
    if (this._cache && Date.now() - this._cache.fetchedAt < CACHE_TTL_MS) {
      return this._cache.listings;
    }
    const listings = await this._fetchListings();
    this._cache = { fetchedAt: Date.now(), listings };
    return listings;
  }

  async _fetchListings() {
    const response = await fetch(this.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
    return response.json();
  }
}

const LOCAL_INDEX_URL = "/plugins-local/index.json";

export class LocalPluginRegistry extends PluginRegistry {
  async getListings() {
    const response = await fetch(LOCAL_INDEX_URL);
    if (!response.ok) {
      throw new Error(`local registry HTTP ${response.status}`);
    }
    return response.json();
  }
}
