const CACHE_PREFIX = "plugin-binary-cache:";

// Cache API keys are Request/URL — this constructs a
// stable, never-dereferenced pseudo-URL per cache key.
function keyUrl(key) {
  return `https://plugin-binary-cache.invalid/${encodeURIComponent(key)}`;
}

function keyFromUrl(url) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export class PluginBinaryCache {
  _cacheName(pluginId) {
    return `${CACHE_PREFIX}${pluginId}`;
  }

  async get(pluginId, key) {
    const cache = await caches.open(this._cacheName(pluginId));
    const response = await cache.match(keyUrl(key));
    if (!response) return null;
    return await response.arrayBuffer();
  }

  async has(pluginId, key) {
    const cache = await caches.open(this._cacheName(pluginId));
    const matches = await cache.keys(keyUrl(key));
    return matches.length > 0;
  }

  async keys(pluginId) {
    const cache = await caches.open(this._cacheName(pluginId));
    const requests = await cache.keys();
    return requests.map((request) => keyFromUrl(request.url));
  }

  async put(pluginId, key, arrayBuffer) {
    const cache = await caches.open(this._cacheName(pluginId));
    await cache.put(keyUrl(key), new Response(arrayBuffer));
  }

  async delete(pluginId, key) {
    const cache = await caches.open(this._cacheName(pluginId));
    await cache.delete(keyUrl(key));
  }

  async clear(pluginId) {
    await caches.delete(this._cacheName(pluginId));
  }
}
