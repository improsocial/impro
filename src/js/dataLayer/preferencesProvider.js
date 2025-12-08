import { getPostLabels } from "/js/dataHelpers.js";
import { deepClone } from "/js/utils.js";
import { DISCOVER_FEED_URI } from "/js/config.js";

function getLabelerForLabel(label, labelers) {
  const matchingLabeler = labelers.find(
    (labeler) => labeler.creator.did === label.src
  );
  return matchingLabeler ?? null;
}

function getDefinitionForLabel(label, labeler) {
  return labeler.policies.labelValueDefinitions.find(
    (definition) => definition.identifier === label.val
  );
}

function getDisplayNameForLabel(label, labeler) {
  const matchingDefinition = getDefinitionForLabel(label, labeler);
  if (!matchingDefinition) {
    return null;
  }
  const enLocale = matchingDefinition.locales.find(
    (locale) => locale.lang === "en"
  );
  return enLocale?.name || "";
}

export class Preferences {
  constructor(obj, labelerDefs) {
    this.obj = obj;
    this.labelerDefs = labelerDefs;
  }

  // Note, these methods return a new Preferences object, instead of mutating the existing one.
  unpinFeed(feedUri) {
    const clone = this.clone();
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(clone.obj);
    const matchingItem = savedFeedsPreference.items.find(
      (item) => item.value === feedUri
    );
    if (matchingItem) {
      matchingItem.pinned = false;
    }
    return clone;
  }

  pinFeed(feedUri, type = "feed") {
    const clone = this.clone();
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(clone.obj);
    const matchingItem = savedFeedsPreference.items.find(
      (item) => item.value === feedUri
    );
    if (matchingItem) {
      matchingItem.pinned = true;
    } else {
      savedFeedsPreference.items.push({
        id: generateTid(),
        value: feedUri,
        type,
        pinned: true,
      });
    }
    return clone;
  }

  getPinnedFeeds() {
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(this.obj);
    if (!savedFeedsPreference) {
      return [];
    }
    return savedFeedsPreference.items.filter((item) => item.pinned);
  }

  getLabelerDids() {
    return Preferences.getLabelerDidsFromPreferences(this.obj);
  }

  getPostLabels(post) {
    const labels = getPostLabels(post, this.labelerDefs);
    const displayLabels = [];
    for (const label of labels) {
      const labeler = getLabelerForLabel(label, this.labelerDefs);
      if (labeler) {
        const displayName = getDisplayNameForLabel(label, labeler);
        if (displayName) {
          displayLabels.push({ displayName, labeler });
        }
      }
    }
    return displayLabels;
  }

  textHasMutedWord(text) {
    const mutedWordsPreference = Preferences.getMutedWordsPreference(this.obj);
    if (!mutedWordsPreference) {
      return false;
    }
    const now = new Date().toISOString();
    const activeItems = mutedWordsPreference.items.filter((item) =>
      item.expiresAt ? item.expiresAt > now : true
    );
    for (const item of activeItems) {
      if (text.toLowerCase().includes(item.value.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  // Todo - memoize this?
  postHasMutedWord(post) {
    const postText = post?.record?.text;
    if (!postText) {
      return false;
    }
    return this.textHasMutedWord(postText);
  }

  quotedPostHasMutedWord(quotedPost) {
    const quotedPostText = quotedPost?.value?.text;
    if (!quotedPostText) {
      return false;
    }
    return this.textHasMutedWord(quotedPostText);
  }

  clone() {
    return new Preferences(deepClone(this.obj), deepClone(this.labelerDefs));
  }

  getFollowingFeedPreference() {
    const followingFeedPreference = this.obj.find(
      (preference) =>
        preference.$type === "app.bsky.actor.defs#feedViewPref" &&
        preference.feed === "home"
    );
    return followingFeedPreference ?? null;
  }

  // Helpers

  static getPreferenceByType(obj, type) {
    return obj.find((preference) => preference.$type === type);
  }

  static getMutedWordsPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#mutedWordsPref"
    );
  }

  static getSavedFeedsPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#savedFeedsPrefV2"
    );
  }

  static getLabelerPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#labelersPref"
    );
  }

  static getImproThemePreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#improThemePref"
    );
  }

  static getLabelerDidsFromPreferences(obj) {
    const labelerPreference = Preferences.getLabelerPreference(obj);
    const labelers = labelerPreference ? labelerPreference.labelers : [];
    return labelers
      .map((labeler) => labeler.did)
      .concat(["did:plc:ar7c4by46qjdydhdevvrndac"]); // default
  }

  static createLoggedOutPreferences() {
    return new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [
            {
              id: "3l6ovcmm2vd2j",
              type: "feed",
              value: DISCOVER_FEED_URI,
              pinned: true,
            },
          ],
        },
      ],
      []
    );
  }
}

export class PreferencesProvider {
  constructor(api) {
    this.api = api;
    this._preferences = null;
  }

  requirePreferences() {
    if (!this._preferences) {
      throw new Error("Preferences not loaded");
    }
    return this._preferences;
  }

  async fetchPreferences() {
    if (!this.api.isAuthenticated) {
      this._preferences = Preferences.createLoggedOutPreferences();
      return;
    }
    const preferencesObj = await this.api.getPreferences();
    const labelerDids =
      Preferences.getLabelerDidsFromPreferences(preferencesObj);
    const labelerDefs = await this.api.getLabelers(labelerDids);
    this._preferences = new Preferences(preferencesObj, labelerDefs);
  }

  async updatePreferences(preferences) {
    await this.api.updatePreferences(preferences.obj);
    this._preferences = preferences;
  }
}
