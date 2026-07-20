const CACHE_NAME = "plugins-v1";

// Responses are cached indefinitely until cleared
// URLs are versioned so new versions should fetch new entries

export class PluginCache {
  async _getCache() {
    return await caches.open(CACHE_NAME);
  }

  async fetch(
    url,
    { doCacheNotFound = false, isNotFound = (status) => status === 404 } = {},
  ) {
    const cache = await this._getCache();
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url, { redirect: "follow" });
      if (response.ok) {
        await cache.put(url, response.clone());
      } else if (doCacheNotFound) {
        const body = await response
          .clone()
          .text()
          .catch(() => null);
        if (isNotFound(response.status, body)) {
          await cache.put(url, response.clone());
        }
      }
    }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} ${url}`);
      error.status = response.status;
      error.body = await response.text().catch(() => null);
      throw error;
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
