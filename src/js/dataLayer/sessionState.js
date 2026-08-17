import { Signal, ReactiveStore, PersistedReactiveStore } from "/js/signals.js";

const LEGACY_SELECTED_FEED_URI_STORAGE_KEY = "home-view-currentFeedUri";

function migrateLegacySelectedFeedUri(storageKey) {
  if (localStorage.getItem(storageKey) !== null) {
    return;
  }
  const legacyStored = localStorage.getItem(
    LEGACY_SELECTED_FEED_URI_STORAGE_KEY,
  );
  localStorage.removeItem(LEGACY_SELECTED_FEED_URI_STORAGE_KEY);
  if (legacyStored === null) {
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

// Local client state, persisted per account. Logged-out session
// state (a null session) doesn't persist.
export function createSessionState(session) {
  let sessionState;
  if (session) {
    const storageKey = `session-state:${session.did}`;
    migrateLegacySelectedFeedUri(storageKey);
    sessionState = new PersistedReactiveStore(storageKey);
  } else {
    sessionState = new ReactiveStore("sessionState");
  }
  // The home view's selected feed, shared with the pinned feeds pane
  sessionState.$selectedFeedUri = new Signal.State(null);
  return sessionState;
}
