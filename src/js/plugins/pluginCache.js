const CACHE_NAME = "plugins-v1";

// Responses are cached indefinitely until cleared
// URLs are versioned so new versions should fetch new entries

export class PluginCache {
  constructor({ cachesImpl, fetchImpl } = {}) {
    this._caches = cachesImpl ?? window.caches;
    this._fetch = fetchImpl ?? ((...args) => window.fetch(...args));
  }

  async _getCache() {
    return await this._caches.open(CACHE_NAME);
  }

  async fetch(url) {
    const cache = await this._getCache();
    let response = await cache.match(url);
    if (!response) {
      response = await this._fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      await cache.put(url, response.clone());
    }
    return response;
  }

  async reconcile(wantedUrls) {
    // Clear unwanted urls
    const cache = await this._getCache();
    const wanted = new Set(wantedUrls);
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((request) => !wanted.has(request.url))
        .map((request) => cache.delete(request)),
    );
  }
}
