import { Signal, ReactiveStore, PersistedReactiveStore } from "/js/signals.js";
import { getDefaultPostLanguageHistory } from "/js/utils.js";

// Local client state, persisted per account. Logged-out session
// state (a null session) doesn't persist.
export function createSessionState(session) {
  let sessionState;
  if (session) {
    sessionState = new PersistedReactiveStore(`session-state:${session.did}`);
  } else {
    sessionState = new ReactiveStore("sessionState");
  }
  // The home view's selected feed, shared with the pinned feeds pane
  sessionState.$selectedFeedUri = new Signal.State(null);
  sessionState.$trendingHidden = new Signal.State(false);
  sessionState.$postLanguageHistory = new Signal.State(
    getDefaultPostLanguageHistory(),
  );
  return sessionState;
}
