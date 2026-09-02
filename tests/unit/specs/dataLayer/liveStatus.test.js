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
import { normalizeUrl, formatDuration } from "/js/utils.js";
import { ApiError } from "/js/api.js";
import { Mutations } from "/js/dataLayer/mutations.js";
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
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
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

  describe("normalizeUrl", () => {
    it("prepends https:// to bare hosts and normalizes", () => {
      assert.equal(normalizeUrl("twitch.tv/foo"), "https://twitch.tv/foo");
      assert.equal(
        normalizeUrl("  https://www.youtube.com/watch "),
        "https://www.youtube.com/watch",
      );
    });
    it("rejects strings without a valid TLD", () => {
      assert.equal(normalizeUrl("nope"), null);
      assert.equal(normalizeUrl("localhost/foo"), null);
      assert.equal(normalizeUrl(""), null);
      assert.equal(normalizeUrl(null), null);
    });
  });

  describe("formatDuration", () => {
    it("formats hours and minutes", () => {
      assert.equal(formatDuration(5), "5 minutes");
      assert.equal(formatDuration(60), "1 hour");
      assert.equal(formatDuration(65), "1 hour 5 minutes");
      assert.equal(formatDuration(120), "2 hours");
      assert.equal(formatDuration(0), "0 minutes");
    });
  });

  describe("mutations.setLiveStatus / clearLiveStatus", () => {
    // Matches the placeholder linkMeta shape the dialog always passes,
    // even on cardyb failure (title falls back to the URL).
    function placeholderLinkMeta(url) {
      return { url, title: url, description: "", image: null };
    }

    function makeApi(overrides = {}) {
      const api = {
        getStatusRecord: mock.fn(async () => {
          const err = new ApiError({
            status: 400,
            statusText: "Bad Request",
            data: { error: "RecordNotFound" },
            headers: {},
            url: "",
          });
          throw err;
        }),
        putStatusRecord: mock.fn(async (record) => ({
          uri: "at://did:plc:live1/app.bsky.actor.status/self",
          cid: "bafyputcid",
          value: record,
        })),
        deleteStatusRecord: mock.fn(async () => ({})),
        uploadBlob: mock.fn(async () => ({
          mimeType: "image/jpeg",
          ref: { $link: "bafthumbcid" },
          size: 123,
        })),
        ...overrides,
      };
      return api;
    }

    function makeSetup(api = makeApi()) {
      const dataStore = new DataStore(createSessionState(null));
      dataStore.$currentUser.set({
        did: "did:plc:live1",
        handle: "live1.test",
      });
      const patchStore = new PatchStore();
      const preferencesProvider = {
        requirePreferences: () => Preferences.createLoggedOutPreferences(),
        $preferences: new Signal.State(
          Preferences.createLoggedOutPreferences(),
        ),
      };
      const mutations = new Mutations(
        api,
        dataStore,
        patchStore,
        preferencesProvider,
        { resolveHandle: async () => null },
        new DraftMediaStore("test-media"),
      );
      return { mutations, dataStore, patchStore, api };
    }

    it("publishes a status, writes it to the current user, and clears patches", async () => {
      const { mutations, dataStore, patchStore, api } = makeSetup();
      await mutations.setLiveStatus({
        durationMinutes: 60,
        linkMeta: {
          url: "https://www.twitch.tv/streamer",
          title: "Cool Stream",
          description: "",
          image: null,
        },
      });
      assert.equal(api.putStatusRecord.mock.calls.length, 1);
      const [record, swapCid] = api.putStatusRecord.mock.calls[0].arguments;
      assert.equal(record.status, "app.bsky.actor.status#live");
      assert.equal(record.durationMinutes, 60);
      assert.equal(record.embed.external.uri, "https://www.twitch.tv/streamer");
      assert.equal(swapCid, null);
      const status = dataStore.$profileStatuses.get("did:plc:live1");
      assert.equal(status.status, "app.bsky.actor.status#live");
      assert.equal(status.embed.external.uri, "https://www.twitch.tv/streamer");
      assert.equal(status.cid, "bafyputcid");
      // No profile-patch dance any more — $profileStatuses is written directly.
      assert.equal(
        patchStore.$profilePatches.get("did:plc:live1") ?? null,
        null,
      );
    });

    it("preserves createdAt on edit and threads durationMinutes through", async () => {
      const { mutations, api } = makeSetup();
      const createdAt = "2025-05-01T12:00:00.000Z";
      await mutations.setLiveStatus({
        durationMinutes: 30,
        linkMeta: placeholderLinkMeta("https://www.twitch.tv/updated"),
        createdAt,
      });
      const record = api.putStatusRecord.mock.calls[0].arguments[0];
      assert.equal(record.createdAt, createdAt);
      assert.equal(record.durationMinutes, 30);
    });

    it("retries on InvalidSwap and eventually succeeds", async () => {
      let attempts = 0;
      const api = makeApi({
        putStatusRecord: mock.fn(async (record) => {
          attempts += 1;
          if (attempts < 3) {
            throw new ApiError({
              status: 400,
              statusText: "Bad Request",
              data: { error: "InvalidSwap" },
              headers: {},
              url: "",
            });
          }
          return { uri: "at://x", cid: "cid3", value: record };
        }),
      });
      const { mutations } = makeSetup(api);
      await mutations.setLiveStatus({
        durationMinutes: 60,
        linkMeta: placeholderLinkMeta("https://www.twitch.tv/a"),
      });
      assert.equal(attempts, 3);
      assert.equal(api.getStatusRecord.mock.calls.length, 3);
    });

    it("swallows thumb upload failures but still publishes", async () => {
      const api = makeApi({
        uploadBlob: mock.fn(async () => {
          throw new Error("upload failed");
        }),
      });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        blob: async () => new Blob(["x"], { type: "image/png" }),
      });
      try {
        const { mutations } = makeSetup(api);
        await mutations.setLiveStatus({
          durationMinutes: 60,
          linkMeta: {
            url: "https://www.twitch.tv/a",
            title: "t",
            description: "",
            image: "https://example.com/img.jpg",
          },
        });
        assert.equal(api.putStatusRecord.mock.calls.length, 1);
        const record = api.putStatusRecord.mock.calls[0].arguments[0];
        assert.equal(record.embed.external.thumb, undefined);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("clearLiveStatus writes explicit null and tolerates RecordNotFound", async () => {
      const { mutations, dataStore, api } = makeSetup();
      // Seed with a status first
      dataStore.$profileStatuses.set(
        "did:plc:live1",
        createLiveStatusView({ did: "did:plc:live1" }),
      );
      api.deleteStatusRecord = mock.fn(async () => {
        throw new ApiError({
          status: 400,
          statusText: "Bad Request",
          data: { error: "RecordNotFound" },
          headers: {},
          url: "",
        });
      });
      await mutations.clearLiveStatus();
      assert.equal(dataStore.$profileStatuses.get("did:plc:live1"), null);
    });
  });

  describe("cross-device convergence", () => {
    it("setProfiles clears a stale status when the fresh payload omits it", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      // Fresh appview payload with no `status` field
      const refreshed = createProfile({
        did,
        handle: "liveuser.bsky.social",
        displayName: "Live User",
      });
      dataStore.setProfiles([refreshed]);
      assert.equal(derived.$actorLiveStatus.get(did).state, "none");
    });

    it("mergeProfile from a post author path preserves an existing status", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      dataStore.mergeProfile({
        did,
        handle: "liveuser.bsky.social",
        displayName: "Live User (from post)",
      });
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
    });

    it("cancels the per-DID expiry timer when the status transitions to none", () => {
      const { derived, dataStore } = makeDerived();
      addLiveProfile(
        dataStore,
        createLiveStatusView({ did, expiresAt: futureExpiry() }),
      );
      // Reading the computed schedules the timer
      assert.equal(derived.$actorLiveStatus.get(did).state, "active");
      assert.equal(derived.liveStatusScheduler.size, 1);
      // Status vanishes
      dataStore.setProfiles([
        createProfile({
          did,
          handle: "liveuser.bsky.social",
          displayName: "Live User",
        }),
      ]);
      assert.equal(derived.$actorLiveStatus.get(did).state, "none");
      assert.equal(derived.liveStatusScheduler.size, 0);
    });
  });
});
