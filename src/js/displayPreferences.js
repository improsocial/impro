import { Signal, PersistedReactiveStore } from "/js/signals.js";

const displayPreferences = new PersistedReactiveStore("display-preferences");

displayPreferences.$trendingHidden = new Signal.State(false);

export { displayPreferences };
