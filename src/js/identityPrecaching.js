import { effect, untrack } from "/js/signals.js";
import { hasValidHandle } from "/js/dataHelpers.js";

export function setUpIdentityPrecaching(dataLayer, identityResolver) {
  const { dataStore } = dataLayer;

  const seenProfiles = new WeakSet();
  const precacheProfile = (profile) => {
    if (!profile || seenProfiles.has(profile)) return;
    seenProfiles.add(profile);
    if (!profile.did || !hasValidHandle(profile)) return;
    identityResolver.setDidForHandle(profile.handle, profile.did);
  };

  // Watch a signal map and precache identities from profiles on change
  function precacheFromSignalMap($map, getProfiles) {
    const seenValues = new WeakSet();
    effect(() => {
      for (const key of $map.keys()) {
        const value = untrack(() => $map.get(key));
        if (!value || seenValues.has(value)) continue;
        seenValues.add(value);
        try {
          getProfiles(value).forEach(precacheProfile);
        } catch (error) {
          console.error("error when precaching identities", value);
          console.error(error);
        }
      }
    });
  }

  // Bsky appview profiles (post authors, search results, etc.) are all merged into $profiles
  precacheFromSignalMap(dataStore.$profiles, (profile) => [profile]);
  // Chat service profiles are kept out of $profiles
  precacheFromSignalMap(dataStore.$convos, (convo) => convo.members);
  precacheFromSignalMap(dataStore.$convoMemberLists, (page) => page.members);
  precacheFromSignalMap(dataStore.$joinLinkPreviewsByCode, (preview) => [
    preview.owner,
  ]);

  effect(() => {
    precacheProfile(dataStore.$currentUser.get());
  });

  effect(() => {
    const preferences = dataLayer.preferencesProvider.$preferences.get();
    if (!preferences) return;
    for (const labelerDef of preferences.labelerDefs) {
      precacheProfile(labelerDef.creator);
    }
  });
}
