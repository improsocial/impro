// Holds the one network address each plugin has been explicitly approved
// to reach via app.customEndpoint (see impro-plugin/main.js's
// CustomEndpoint and pluginService.js's requestCustomEndpointUrl/
// customEndpointFetch host methods). Deliberately a separate store from
// PluginLocalDataStore even though the underlying mechanism is the same
// (device-local, unsynced localStorage): loadLocalData/saveLocalData hand a
// plugin free read/write access to its own blob, and an approval a plugin
// could silently rewrite itself would defeat the point of requiring a
// human to approve it first. Sessions without a DID get a
// PluginCustomEndpointMemoryStore instead, which lasts only for the
// session — matching PluginMemoryDataStore's fallback.

const KEY_PREFIX = "improPluginCustomEndpoint";

export class PluginCustomEndpointStore {
  constructor(did) {
    this.did = did;
  }

  _key(pluginId) {
    return `${KEY_PREFIX}:${this.did}:${pluginId}`;
  }

  get(pluginId) {
    return localStorage.getItem(this._key(pluginId));
  }

  set(pluginId, url) {
    localStorage.setItem(this._key(pluginId), url);
  }

  clear(pluginId) {
    localStorage.removeItem(this._key(pluginId));
  }
}

export class PluginCustomEndpointMemoryStore {
  constructor() {
    this._data = new Map();
  }

  get(pluginId) {
    return this._data.get(pluginId) ?? null;
  }

  set(pluginId, url) {
    this._data.set(pluginId, url);
  }

  clear(pluginId) {
    this._data.delete(pluginId);
  }
}
