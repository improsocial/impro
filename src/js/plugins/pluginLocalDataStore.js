// Device-local (unsynced) storage for arbitrary plugin data — the local
// counterpart to loadData/saveData, which round-trips through the user's
// AT-proto preferences record and syncs across every device/session on the
// account. Some plugin data should never leave the device it was created on
// (e.g. a locally-held secret key a "tags"-style plugin uses to derive
// record keys) — this is that tier. Mirrors the existing precedent in
// pluginEndpointStore.js (device-local storage for a plugin's configured
// network endpoint), generalized to hold arbitrary JSON rather than a
// single URL string.

const KEY_PREFIX = "improPluginLocalData:";

export function getLocalData(pluginId) {
  const raw = localStorage.getItem(KEY_PREFIX + pluginId);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLocalData(pluginId, data) {
  localStorage.setItem(KEY_PREFIX + pluginId, JSON.stringify(data));
}

export function clearLocalData(pluginId) {
  localStorage.removeItem(KEY_PREFIX + pluginId);
}
