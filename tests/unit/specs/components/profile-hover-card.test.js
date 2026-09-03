import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import "/js/components/profile-hover-card.js";
import {
  createLiveStatusView,
  createProfile,
} from "../../../shared/factories.js";
import { makeTestDataLayer } from "../../testHelpers.js";

// The element renders reactively via an effect(), which flushes on rAF.
const flushRender = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

function makeDetailedProfile(overrides = {}) {
  return createProfile({
    did: "did:plc:target",
    handle: "target.bsky.social",
    displayName: "Target User",
    description: "A test bio.",
    followersCount: 42,
    followsCount: 7,
    viewer: { muted: false, blockedBy: false, following: null },
    ...overrides,
  });
}

function makeSetup({
  detailedProfile = null,
  basicProfile = null,
  currentUser = null,
} = {}) {
  const dataLayer = makeTestDataLayer();
  if (detailedProfile) {
    // Route through setDetailedProfile so `status` is extracted into
    // $profileStatuses like production ingestion does.
    dataLayer.dataStore.setDetailedProfile(detailedProfile);
  }
  if (basicProfile) {
    dataLayer.dataStore.setProfiles([basicProfile]);
  }
  if (currentUser) {
    dataLayer.dataStore.$currentUser.set(currentUser);
    if (currentUser.status !== undefined) {
      dataLayer.dataStore.$profileStatuses.set(
        currentUser.did,
        currentUser.status,
      );
    }
  }
  const followCalls = [];
  const interactionHandlers = {
    profileInteractionHandler: {
      handleFollow: (profile, doFollow) =>
        followCalls.push({ profile, doFollow }),
    },
  };
  return { dataLayer, interactionHandlers, followCalls };
}

function mountCard({ dataLayer, interactionHandlers, did = "did:plc:target" }) {
  const el = document.createElement("profile-hover-card");
  el.dataLayer = dataLayer;
  el.interactionHandlers = interactionHandlers;
  document.body.appendChild(el);
  el.did = did;
  return el;
}

describe("<profile-hover-card>", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  after(() => {
    document.body.innerHTML = "";
  });

  it("renders a loading spinner when no profile is available", async () => {
    const { dataLayer, interactionHandlers } = makeSetup();
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert(card.querySelector(".profile-hover-card-loading") !== null);
    assert(card.querySelector('[data-testid="hover-card-name"]') === null);
  });

  it("renders name, handle, counts, and bio for a detailed profile", async () => {
    const profile = makeDetailedProfile();
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert.equal(
      card.querySelector('[data-testid="hover-card-name"]').textContent.trim(),
      "Target User",
    );
    assert.match(card.textContent, /@target\.bsky\.social/);
    assert.match(
      card.querySelector('[data-testid="hover-card-followers-link"]')
        .textContent,
      /42/,
    );
    assert.match(
      card.querySelector('[data-testid="hover-card-following-link"]')
        .textContent,
      /7/,
    );
    assert.match(card.textContent, /A test bio\./);
  });

  it("shows a follow button when viewing another user", async () => {
    const profile = makeDetailedProfile();
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    const btn = card.querySelector('[data-testid="follow-button"]');
    assert(btn !== null);
    assert.equal(btn.dataset.teststate, "follow");
  });

  it("disables the follow button while a follow patch is pending", async () => {
    const profile = makeDetailedProfile();
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert.equal(
      card.querySelector('[data-testid="follow-button"]').disabled,
      false,
    );
    dataLayer.patchStore.addProfilePatch(profile.did, {
      type: "followProfile",
    });
    await flushRender();
    assert.equal(
      card.querySelector('[data-testid="follow-button"]').disabled,
      true,
    );
  });

  it("hides the follow button when viewing self", async () => {
    const profile = makeDetailedProfile({ did: "did:plc:me" });
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:me" },
    });
    const card = mountCard({
      dataLayer,
      interactionHandlers,
      did: "did:plc:me",
    });
    await flushRender();
    assert(card.querySelector('[data-testid="follow-button"]') === null);
    assert(
      card.querySelector('[data-testid="hover-card-view-profile"]') === null,
    );
  });

  it("renders View profile and hides counts for a blocked profile", async () => {
    const profile = makeDetailedProfile({
      viewer: { blocking: "at://x", following: null, followedBy: null },
    });
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert(
      card.querySelector('[data-testid="hover-card-view-profile"]') !== null,
    );
    assert(
      card.querySelector('[data-testid="hover-card-followers-link"]') === null,
    );
    assert(card.querySelector('[data-testid="follow-button"]') === null);
  });

  it("invokes handleFollow when the follow button is clicked", async () => {
    const profile = makeDetailedProfile();
    const { dataLayer, interactionHandlers, followCalls } = makeSetup({
      detailedProfile: profile,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    card.querySelector('[data-testid="follow-button"]').click();
    assert.equal(followCalls.length, 1);
    assert.equal(followCalls[0].profile.did, "did:plc:target");
    assert.equal(followCalls[0].doFollow, true);
  });

  it("re-renders when the underlying profile signal updates", async () => {
    const initial = makeDetailedProfile({ displayName: "Old Name" });
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: initial,
      currentUser: { did: "did:plc:viewer" },
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert.match(card.textContent, /Old Name/);
    dataLayer.dataStore.$detailedProfiles.set(
      initial.did,
      makeDetailedProfile({ displayName: "New Name" }),
    );
    await flushRender();
    assert.match(card.textContent, /New Name/);
  });

  it("renders the live status card instead of the profile body when live", async () => {
    const profile = makeDetailedProfile({
      status: createLiveStatusView({
        did: "did:plc:target",
        url: "https://www.twitch.tv/target",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert(card.querySelector('[data-testid="live-status-card"]') !== null);
    assert.equal(
      card
        .querySelector('[data-testid="live-status-watch"]')
        .getAttribute("href"),
      "https://www.twitch.tv/target",
    );
    assert(card.querySelector('[data-testid="hover-card-name"]') === null);
  });

  it("renders the normal profile body when the status is expired", async () => {
    const profile = makeDetailedProfile({
      status: createLiveStatusView({
        did: "did:plc:target",
        url: "https://www.twitch.tv/target",
        expiresAt: "2025-01-15T13:00:00.000Z",
      }),
    });
    const { dataLayer, interactionHandlers } = makeSetup({
      detailedProfile: profile,
    });
    const card = mountCard({ dataLayer, interactionHandlers });
    await flushRender();
    assert(card.querySelector('[data-testid="live-status-card"]') === null);
    assert(card.querySelector('[data-testid="hover-card-name"]') !== null);
  });
});
