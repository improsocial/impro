// Device-local (unsynced) storage for arbitrary plugin data — the local
// counterpart to loadData/saveData, which sync across devices via the
// account's preferences. Sessions without a DID get a PluginMemoryDataStore
// instead, which lasts only for the session.

const KEY_PREFIX = "improPluginLocalData";

export class PluginLocalDataStore {
  constructor(did) {
    this.did = did;
  }

  _key(pluginId) {
    return `${KEY_PREFIX}:${this.did}:${pluginId}`;
  }

  get(pluginId) {
    const raw = localStorage.getItem(this._key(pluginId));
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  set(pluginId, data) {
    localStorage.setItem(this._key(pluginId), JSON.stringify(data));
  }

  clear(pluginId) {
    localStorage.removeItem(this._key(pluginId));
  }
}

export class PluginMemoryDataStore {
  constructor() {
    this._data = new Map();
  }

  get(pluginId) {
    return this._data.get(pluginId) ?? null;
  }

  set(pluginId, data) {
    this._data.set(pluginId, data);
  }

  clear(pluginId) {
    this._data.delete(pluginId);
  }
}
