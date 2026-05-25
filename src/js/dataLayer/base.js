// Single-entity reads composed with patch-store optimistic updates.
// This is the "current state" of an entity from the user's perspective —
// what they believe the server holds, including in-flight mutations.
// View-layer derivation (mute/hide/labels) is layered above this via derived.

export function getPost(dataStore, patchStore, uri) {
  const raw = dataStore.getPost(uri);
  if (!raw) return null;
  return patchStore.applyPostPatches(raw);
}
