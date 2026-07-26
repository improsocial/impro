import { SignalMap } from "/js/signals.js";

// Store for feed items hidden by plugins
export class HiddenFeedItemsStore {
  constructor() {
    this.$items = new SignalMap();
  }

  get(feedURI) {
    return this.$items.get(feedURI) ?? {};
  }

  replace(feedURI, overrides) {
    this.$items.set(feedURI, { ...overrides });
  }

  merge(feedURI, overrides) {
    const existing = this.$items.get(feedURI) ?? {};
    this.$items.set(feedURI, { ...existing, ...overrides });
  }

  clear(feedURI) {
    this.$items.delete(feedURI);
  }
}
