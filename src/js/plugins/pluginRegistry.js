const CACHE_TTL_MS = 120_000;
const LOCAL_INDEX_URL = "/plugins-local/index.json";

export class PluginRegistry {
  constructor(url, { fetchImpl, localOnly = false } = {}) {
    this.url = url;
    this.localOnly = localOnly;
    this._fetch = fetchImpl ?? ((...args) => window.fetch(...args));
    this._cache = null;
  }

  async getPluginListings({ force = false } = {}) {
    if (
      !force &&
      this._cache &&
      Date.now() - this._cache.fetchedAt < CACHE_TTL_MS
    ) {
      return this._cache.listings;
    }
    const [remoteListings, localListings] = await Promise.all([
      this.localOnly ? [] : this._fetchRemoteListings(),
      this._fetchLocalListings(),
    ]);
    const localSet = new Set(localListings.map((listing) => listing.id));
    const listings = [
      ...localListings.map((listing) => ({ ...listing, local: true })),
      ...remoteListings.filter((listing) => !localSet.has(listing.id)),
    ];
    this._cache = { fetchedAt: Date.now(), listings };
    return listings;
  }

  async _fetchRemoteListings() {
    const response = await this._fetch(this.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  }

  async _fetchLocalListings() {
    try {
      const response = await this._fetch(LOCAL_INDEX_URL);
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body) ? body : [];
    } catch {
      return [];
    }
  }

  async getPluginListing(id, opts) {
    const all = await this.getPluginListings(opts);
    return all.find((listing) => listing.id === id) ?? null;
  }
}
