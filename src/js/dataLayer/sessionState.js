import { Signal, ReactiveStore, PersistedReactiveStore } from "/js/signals.js";

const LEGACY_SELECTED_FEED_URI_STORAGE_KEY = "home-view-currentFeedUri";
const LEGACY_DISPLAY_PREFERENCES_STORAGE_KEY = "display-preferences";

function migrateLegacySelectedFeedUri(storageKey) {
  const legacyStored = localStorage.getItem(
    LEGACY_SELECTED_FEED_URI_STORAGE_KEY,
  );
  localStorage.removeItem(LEGACY_SELECTED_FEED_URI_STORAGE_KEY);
  if (legacyStored === null || localStorage.getItem(storageKey) !== null) {
    return;
  }
  let selectedFeedUri = null;
  try {
    selectedFeedUri = JSON.parse(legacyStored);
  } catch {
    return;
  }
  if (!selectedFeedUri) {
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify({ selectedFeedUri }));
}

function migrateLegacyDisplayPreferences(storageKey) {
  const legacyStored = localStorage.getItem(
    LEGACY_DISPLAY_PREFERENCES_STORAGE_KEY,
  );
  localStorage.removeItem(LEGACY_DISPLAY_PREFERENCES_STORAGE_KEY);
  if (legacyStored === null) {
    return;
  }
  let legacyPreferences = null;
  try {
    legacyPreferences = JSON.parse(legacyStored);
  } catch {
    return;
  }
  if (typeof legacyPreferences?.trendingHidden !== "boolean") {
    return;
  }
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    stored = {};
  }
  if ("trendingHidden" in stored) {
    return;
  }
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...stored,
      trendingHidden: legacyPreferences.trendingHidden,
    }),
  );
}

// Local client state, persisted per account. Logged-out session
// state (a null session) doesn't persist.
export function createSessionState(session) {
  let sessionState;
  if (session) {
    const storageKey = `session-state:${session.did}`;
    migrateLegacySelectedFeedUri(storageKey);
    migrateLegacyDisplayPreferences(storageKey);
    sessionState = new PersistedReactiveStore(storageKey);
  } else {
    sessionState = new ReactiveStore("sessionState");
  }
  // The home view's selected feed, shared with the pinned feeds pane
  sessionState.$selectedFeedUri = new Signal.State(null);
  sessionState.$trendingHidden = new Signal.State(false);
  return sessionState;
}
