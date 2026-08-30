import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Derived } from "/js/dataLayer/derived.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";
import { HiddenFeedItemsStore } from "/js/dataLayer/hiddenFeedItemsStore.js";
import { DraftMediaStore } from "/js/drafts.js";
import { isAllowedLiveHost, isStatusValid } from "/js/dataHelpers.js";
import {
  createLiveStatusView,
  createPost,
  createProfile,
} from "../../../shared/factories.js";
import { trackDisposable } from "../../testHelpers.js";

const did = "did:plc:liveuser1";

function makeDerived({ preferences } = {}) {
  const dataStore = new DataStore(createSessionState(null));
  const patchStore = new PatchStore();
  const prefs = preferences ?? Preferences.createLoggedOutPreferences();
  const preferencesProvider = {
    requirePreferences: () => prefs,
    $preferences: new Signal.State(prefs),
  };
  const derived = new Derived(
    dataStore,
    patchStore,
    preferencesProvider,
    new HiddenFeedItemsStore(),
    false,
    new DraftMediaStore("test-media"),
  );
  trackDisposable(derived.liveStatusScheduler);
  return { derived, dataStore };
}

function addLiveProfile(dataStore, status, profileOverrides = {}) {
  const profile = createProfile({
    did,
    handle: "liveuser.bsky.social",
    displayName: "Live User",
    status,
    ...profileOverrides,
  });
  dataStore.setProfiles([profile]);
  return profile;
}

function futureExpiry(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

describe("live status", () => {
  describe("isAllowedLiveHost", () => {
    it("allows exact hosts and subdomains of allowed domains", () => {
      assert(isAllowedLiveHost("https://twitch.tv/somebody"));
      assert(isAllowedLiveHost("https://www.twitch.tv/somebody"));
      assert(isAllowedLiveHost("https://m.twitch.tv/somebody"));
      assert(isAllowedLiveHost("https://www.youtube.com/watch?v=abc"));
    });

    it("rejects lookalike hosts, disallowed hosts, and non-URLs", () => {
      assert(!isAllowedLiveHost("https://twitch.tv.evil.com/somebody"));
      assert(!isAllowedLiveHost("https://eviltwitch.tv/somebody"));
      assert(!isAllowedLiveHost("https://example.com/stream"));
      assert(!isAllowedLiveHost("not a url"));
      assert(!isAllowedLiveHost(""));
    });
  });

  describe("isStatusValid", () => {
    it("accepts a structurally valid statusView", () => {
      assert.equal(isStatusValid(createLiveStatusView({ did })), true);
    });

    it("rejects wrong status values, missing uri, and missing expiresAt", () => {
      assert.equal(isStatusValid(null), false);
      assert.equal(
        isStatusValid(createLiveStatusView({ did, expiresAt: null })),
        false,
      );
      assert.equal(
        isStatusValid({
          ...createLiveStatusView({ did }),
          status: "app.bsky.actor.status#other",
        }),
        false,
      );
      assert.equal(
        isStatusValid({
          ...createLiveStatusView({ did }),
          uri: undefined,
        }),
        false,
      );
    });

    it("rejects missing, non-external, and disallowed-host embeds", () => {
      assert.equal(
        isStatusValid(createLiveStatusView({ did, embed: null })),
        false,
      );
      assert.equal(
        isStatusValid(
          createLiveStatusView({
            did,
            embed: { $type: "app.bsky.embed.images#view", images: [] },
          }),
        ),
        false,
      );
      assert.equal(
        isStatusValid(
          createLiveStatusView({ did, url: "https://example.com/stream" }),
        ),
        false,
      );
    });
  });

  describe("$actorLiveStatus", () => {
    it("returns none when the profile has no status", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(dataStore, undefined);
      assert.deepEqual(derived.$actorLiveStatus.get(did), { state: "none" });
      assert.equal(derived.$isActorLive.get(did), false);
    });

    it("returns active for a valid unexpired status", () => {
      const { derived, dataStore } = makeDerived();
      const expiresAt = futureExpiry();
      const status = createLiveStatusView({ did, expiresAt });
      addLiveProfile(dataStore, status);
      const liveStatus = derived.$actorLiveStatus.get(did);
      assert.equal(liveStatus.state, "active");
      assert.equal(liveStatus.uri, `at://${did}/app.bsky.actor.status/self`);
      assert.equal(liveStatus.expiresAt, expiresAt);
      assert.equal(
        liveStatus.embed.external.uri,
        "https://www.twitch.tv/testuser",
      );
      assert.equal(derived.$isActorLive.get(did), true);
    });

    it("returns inactive for an expired status", () => {
      const { derived, dataStore } = makeDerived();
      const status = createLiveStatusView({
        did,
        expiresAt: "2025-01-15T13:00:00.000Z",
      });
      addLiveProfile(dataStore, status);
      const liveStatus = derived.$actorLiveStatus.get(did);
      assert.equal(liveStatus.state, "inactive");
      assert.equal(liveStatus.uri, `at://${did}/app.bsky.actor.status/self`);
      assert.equal(derived.$isActorLive.get(did), false);
    });

    it("returns inactive when expiresAt is missing", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(dataStore, createLiveStatusView({ did, expiresAt: null }));
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
    });

    it("returns inactive for a bad embed or disallowed host", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({
          did,
          expiresAt: futureExpiry(),
          url: "https://example.com/stream",
        }),
      );
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
    });

    it("returns inactive with isDisabled for a disabled status", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({
          did,
          expiresAt: futureExpiry(),
          isDisabled: true,
        }),
      );
      const liveStatus = derived.$actorLiveStatus.get(did);
      assert.equal(liveStatus.state, "inactive");
      assert.equal(liveStatus.isDisabled, true);
    });

    it("returns none when the viewer blocks or mutes the author", () => {
      for (const viewer of [
        { blocking: "at://block" },
        { blockedBy: true },
        { muted: true },
      ]) {
        const { derived, dataStore } = makeDerived();
        addLiveProfile(
          dataStore,
          createLiveStatusView({ did, expiresAt: futureExpiry() }),
          { viewer },
        );
        assert.deepEqual(derived.$actorLiveStatus.get(did), { state: "none" });
      }
    });

    it("returns none when the profile has a blur label", () => {
      const preferences = {
        getProfileBlurLabel: () => "porn",
        clone() {
          return this;
        },
      };
      const { derived, dataStore } = makeDerived({ preferences });
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
      assert.deepEqual(derived.$actorLiveStatus.get(did), { state: "none" });
    });

    it("attaches isLive to hydrated profiles and post authors", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
      const post = createPost({
        uri: `at://${did}/app.bsky.feed.post/live1`,
        text: "hello",
        authorHandle: "liveuser.bsky.social",
        authorDisplayName: "Live User",
      });
      dataStore.setPosts([post]);
      assert.equal(derived.$hydratedProfiles.get(did).isLive, true);
      assert.equal(derived.$hydratedPosts.get(post.uri).author.isLive, true);
    });

    it("does not attach isLive when the status is inactive", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(dataStore, createLiveStatusView({ did }));
      assert.equal(derived.$hydratedProfiles.get(did).isLive, undefined);
    });
  });

  describe("expiry flip via the scheduled recheck", () => {
    beforeEach(() => {
      mock.timers.enable({
        apis: ["setTimeout", "Date"],
        now: Date.parse("2025-01-15T12:30:00.000Z"),
      });
    });

    afterEach(() => {
      mock.timers.reset();
    });

    it("judging an unexpired status arms a recheck that flips it at expiry", () => {
      const { derived, dataStore } = makeDerived();
      // Expires at 13:00; the mocked clock starts at 12:30
      addLiveProfile(dataStore, createLiveStatusView({ did }));
      // No timer until something reads the judgment
      assert.equal(derived.liveStatusScheduler.size, 0);
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      assert.equal(derived.liveStatusScheduler.size, 1);

      mock.timers.tick(29 * 60 * 1000);
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");

      mock.timers.tick(2 * 60 * 1000);
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
      assert.equal(derived.liveStatusScheduler.size, 0);
    });

    it("arms no timer for absent or already-expired statuses", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(dataStore, undefined);
      assert.equal(derived.$actorLiveStatus.get(did).state, "none");
      assert.equal(derived.liveStatusScheduler.size, 0);
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: "2025-01-15T12:00:00.000Z" }),
      );
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
      assert.equal(derived.liveStatusScheduler.size, 0);
    });

    it("re-arms for the new deadline when a rewrite extends the expiry", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(dataStore, createLiveStatusView({ did }));
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");

      // A later write extends the expiry to 14:00; the next judgment re-arms
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: "2025-01-15T14:00:00.000Z" }),
      );
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      assert.equal(derived.liveStatusScheduler.size, 1);

      mock.timers.tick(35 * 60 * 1000);
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      mock.timers.tick(60 * 60 * 1000);
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
    });

    it("flips liveness for profiles written via setDetailedProfile", () => {
      const { derived, dataStore } = makeDerived();
      const profile = createProfile({
        did,
        handle: "liveuser.bsky.social",
        displayName: "Live User",
        status: createLiveStatusView({ did }),
      });
      dataStore.setDetailedProfile(profile);
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");

      mock.timers.tick(31 * 60 * 1000);
      assert.equal(derived.$actorLiveStatus.get(did).state, "inactive");
      assert.equal(
        derived.$hydratedDetailedProfiles.get(did).isLive,
        undefined,
      );
    });
  });
});
