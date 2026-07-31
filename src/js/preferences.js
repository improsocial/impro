import {
  getPostLabels,
  getLabelerForLabel,
  getDefinitionForLabel,
  isBadgeLabel,
  getLabelNameAndDescription,
  getGlobalLabelDefinition,
  getDefaultLabelSetting,
  isGlobalLabel,
} from "/js/dataHelpers.js";
import { deepClone } from "/js/utils.js";
import { generateTid } from "/js/atproto.js";
import { LOGGED_OUT_FEED_URI, BSKY_LABELER_DID } from "/js/config.js";
import { getTagsFromFacets } from "/js/facetHelpers.js";
import { isListFeed } from "/js/dataHelpers.js";

export const HIDDEN_POSTS_PREF_TYPE =
  "app.bsky.actor.defs#improHiddenPostsPref";
export const PLUGIN_SETTINGS_PREF_TYPE =
  "app.bsky.actor.defs#improPluginSettingsPref";
export const INSTALLED_PLUGINS_PREF_TYPE =
  "app.bsky.actor.defs#improInstalledPluginsPref";
export const SEARCH_HISTORY_PREF_TYPE =
  "app.bsky.actor.defs#improSearchHistoryPref";

function getContentTextFromEmbed(embed) {
  const texts = [];

  switch (embed.$type) {
    case "app.bsky.embed.images":
      for (const image of embed.images) {
        if (image.alt) {
          texts.push(image.alt);
        }
      }
      break;
    case "app.bsky.embed.external":
      if (embed.external.title) {
        texts.push(embed.external.title);
      }
      if (embed.external.description) {
        texts.push(embed.external.description);
      }
      break;
    case "app.bsky.embed.recordWithMedia":
      texts.push(...getContentTextFromEmbed(embed.media));
      break;
  }

  return texts;
}

const MAX_RECENT_SEARCHES = 5;
const MAX_RECENT_SEARCH_PROFILES = 10;
const MAX_RECENT_SEARCH_QUERY_LENGTH = 300;

const WORD_BOUNDARY_REGEX = /[\s\n\t\r\f\v]+/g;
const LEADING_TRAILING_PUNCTUATION_REGEX = /(?:^\p{P}+|\p{P}+$)/gu;
const INTERNAL_PUNCTUATION_REGEX = /\p{P}+/gu;
const LANGUAGE_EXCEPTIONS = ["ja", "zh", "ko", "th", "vi"];

// Muted word matching logic to match:
// https://github.com/bluesky-social/atproto/blob/538d39e19dd4349ca1332f0848cf4b64faf5f75c/packages/api/src/moderation/mutewords.ts
function textMatchesMutedWord(text, mutedWord, languages) {
  const normalizedText = text.toLowerCase();
  const normalizedMutedWord = mutedWord.toLowerCase();
  const primaryLanguage = languages.length > 0 ? languages[0] : "";
  const isLanguageException = LANGUAGE_EXCEPTIONS.includes(primaryLanguage);
  const isSingleCharacter = normalizedMutedWord.length === 1;
  const isPhrase = normalizedMutedWord.includes(" ");
  // Substring matching for single characters, phrases, and language exceptions
  if (isSingleCharacter || isPhrase || isLanguageException) {
    return normalizedText.includes(normalizedMutedWord);
  }
  // Word boundary matching for single words
  const words = normalizedText.split(WORD_BOUNDARY_REGEX);
  for (const word of words) {
    if (!word || word.includes("/")) continue;
    const wordTrimmed = word.replace(LEADING_TRAILING_PUNCTUATION_REGEX, "");
    if (wordTrimmed === normalizedMutedWord) {
      return true;
    }
    // If word has internal punctuation, split it and check each part
    if (INTERNAL_PUNCTUATION_REGEX.test(wordTrimmed)) {
      const subWords = wordTrimmed
        .replace(INTERNAL_PUNCTUATION_REGEX, " ")
        .split(" ");
      for (const subWord of subWords) {
        if (subWord === normalizedMutedWord) {
          return true;
        }
      }
      // Also try matching with all punctuation removed (e.g., "don't" -> "dont")
      const wordNoPunctuation = wordTrimmed.replace(
        INTERNAL_PUNCTUATION_REGEX,
        "",
      );
      if (wordNoPunctuation === normalizedMutedWord) {
        return true;
      }
    }
  }
  return false;
}

export class Preferences {
  constructor(obj, labelerDefs, { persist = true } = {}) {
    this.obj = obj;
    this.labelerDefs = labelerDefs;
    this.persist = persist;
  }

  // Note, these methods return a new Preferences object, instead of mutating the existing one.
  unpinFeed(feedUri) {
    const clone = this.clone();
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(clone.obj);
    if (!savedFeedsPreference) {
      throw new Error("Saved feeds preference not found");
    }
    const matchingItem = savedFeedsPreference.items.find(
      (item) => item.value === feedUri,
    );
    if (matchingItem) {
      matchingItem.pinned = false;
    }
    return clone;
  }

  pinFeed(feedUri, type = "feed") {
    const clone = this.clone();
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(clone.obj);
    if (!savedFeedsPreference) {
      throw new Error("Saved feeds preference not found");
    }
    const matchingItem = savedFeedsPreference.items.find(
      (item) => item.value === feedUri,
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

  setPinnedItems(values) {
    const clone = this.clone();
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(clone.obj);
    if (!savedFeedsPreference) {
      throw new Error("Saved feeds preference not found");
    }
    const valueSet = new Set(values);
    for (const item of savedFeedsPreference.items) {
      item.pinned = valueSet.has(item.value);
    }
    const byValue = new Map(
      savedFeedsPreference.items.map((item) => [item.value, item]),
    );
    const reordered = values.map((value) => byValue.get(value)).filter(Boolean);
    const reorderedSet = new Set(reordered);
    const rest = savedFeedsPreference.items.filter(
      (item) => !reorderedSet.has(item),
    );
    savedFeedsPreference.items = [...reordered, ...rest];
    return clone;
  }

  hidePost(postUri) {
    const clone = this.clone();
    let hiddenPostsPreference = Preferences.getHiddenPostsPreference(clone.obj);
    // If the preference doesn't exist, create it
    if (!hiddenPostsPreference) {
      hiddenPostsPreference = {
        $type: HIDDEN_POSTS_PREF_TYPE,
        items: [],
      };
      clone.obj.push(hiddenPostsPreference);
    }
    hiddenPostsPreference.items.push(postUri);
    return clone;
  }

  getRecentSearches() {
    const pref = Preferences.getSearchHistoryPreference(this.obj);
    if (!pref || !Array.isArray(pref.searches)) {
      return [];
    }
    return pref.searches
      .filter(
        (entry) => typeof entry?.q === "string" && entry.q.trim().length > 0,
      )
      .map((entry) => ({ ...entry, ts: Number(entry.ts) || 0 }))
      .slice(0, MAX_RECENT_SEARCHES);
  }

  addRecentSearch(q) {
    const clone = this.clone();
    const query = (q ?? "").trim().slice(0, MAX_RECENT_SEARCH_QUERY_LENGTH);
    if (!query) {
      return clone;
    }
    const pref = Preferences.ensureSearchHistoryPreference(clone.obj);
    if (!Array.isArray(pref.searches)) {
      pref.searches = [];
    }
    pref.searches = pref.searches.filter((entry) => entry?.q !== query);
    pref.searches.unshift({ q: query, ts: Date.now() });
    pref.searches = pref.searches.slice(0, MAX_RECENT_SEARCHES);
    return clone;
  }

  removeRecentSearch(q) {
    const clone = this.clone();
    const pref = Preferences.getSearchHistoryPreference(clone.obj);
    if (!pref || !Array.isArray(pref.searches)) {
      return clone;
    }
    pref.searches = pref.searches.filter((entry) => entry?.q !== q);
    return clone;
  }

  getRecentSearchProfiles() {
    const pref = Preferences.getSearchHistoryPreference(this.obj);
    if (!pref || !Array.isArray(pref.profiles)) {
      return [];
    }
    return pref.profiles
      .filter((did) => typeof did === "string" && did.length > 0)
      .slice(0, MAX_RECENT_SEARCH_PROFILES);
  }

  addRecentSearchProfile(did) {
    const clone = this.clone();
    if (typeof did !== "string" || did.length === 0) {
      return clone;
    }
    const pref = Preferences.ensureSearchHistoryPreference(clone.obj);
    if (!Array.isArray(pref.profiles)) {
      pref.profiles = [];
    }
    pref.profiles = pref.profiles.filter((existing) => existing !== did);
    pref.profiles.unshift(did);
    pref.profiles = pref.profiles.slice(0, MAX_RECENT_SEARCH_PROFILES);
    return clone;
  }

  removeRecentSearchProfile(did) {
    const clone = this.clone();
    const pref = Preferences.getSearchHistoryPreference(clone.obj);
    if (!pref || !Array.isArray(pref.profiles)) {
      return clone;
    }
    pref.profiles = pref.profiles.filter((existing) => existing !== did);
    return clone;
  }

  removeRecentSearchProfiles(dids) {
    const clone = this.clone();
    const pref = Preferences.getSearchHistoryPreference(clone.obj);
    if (!pref || !Array.isArray(pref.profiles)) {
      return clone;
    }
    const removedSet = new Set(dids);
    pref.profiles = pref.profiles.filter((did) => !removedSet.has(did));
    return clone;
  }

  getPinnedFeeds() {
    const savedFeedsPreference = Preferences.getSavedFeedsPreference(this.obj);
    if (!savedFeedsPreference) {
      return [];
    }
    return savedFeedsPreference.items.filter((item) => item.pinned);
  }

  isFeedPinned(feedUri) {
    return this.getPinnedFeeds().some((feed) => feed.value === feedUri);
  }

  getLabelerDids() {
    return Preferences.getLabelerDidsFromPreferences(this.obj);
  }

  isSubscribedToLabeler(did) {
    const labelerPreference = Preferences.getLabelerPreference(this.obj);
    if (!labelerPreference) {
      return false;
    }
    return labelerPreference.labelers.some((labeler) => labeler.did === did);
  }

  subscribeLabeler(did, labelerInfo) {
    const clone = this.clone();
    let labelerPreference = Preferences.getLabelerPreference(clone.obj);
    if (!labelerPreference) {
      labelerPreference = {
        $type: "app.bsky.actor.defs#labelersPref",
        labelers: [],
      };
      clone.obj.push(labelerPreference);
    }
    if (!labelerPreference.labelers.some((l) => l.did === did)) {
      labelerPreference.labelers.push({ did });
    }
    // Add labeler definition if not already present
    if (!clone.labelerDefs.some((l) => l.creator.did === did)) {
      clone.labelerDefs.push(labelerInfo);
    }
    return clone;
  }

  unsubscribeLabeler(did) {
    const clone = this.clone();
    const labelerPreference = Preferences.getLabelerPreference(clone.obj);
    if (!labelerPreference) {
      return clone;
    }
    labelerPreference.labelers = labelerPreference.labelers.filter(
      (labeler) => labeler.did !== did,
    );
    // Remove labeler definition
    clone.labelerDefs = clone.labelerDefs.filter((l) => l.creator.did !== did);
    return clone;
  }

  getContentLabelPref({ label, labelerDid = null }) {
    const contentLabelPrefs = Preferences.getContentLabelPreferences(this.obj);
    const matchingPref = contentLabelPrefs.find((pref) => {
      // Global label preferences have no labelerDid
      if (labelerDid && pref.labelerDid !== labelerDid) {
        return false;
      }
      if (pref.label !== label) {
        return false;
      }
      return true;
    });
    return matchingPref ?? null;
  }

  getLabelVisibility(label, labelDefinition) {
    // Non-configurable global labels always use their default
    if (labelDefinition.configurable === false) {
      return getDefaultLabelSetting(labelDefinition);
    }
    const pref = this.getContentLabelPref({
      label: label.val,
      labelerDid: isGlobalLabel(label.val) ? null : label.src,
    });
    return pref?.visibility ?? getDefaultLabelSetting(labelDefinition);
  }

  getLabelDefinitionAndLabeler(label) {
    // First check global labels
    const globalDef = getGlobalLabelDefinition(label.val);
    if (globalDef) {
      return { labelDefinition: globalDef, labeler: null };
    }
    // Then check labeler-defined labels
    const labeler = getLabelerForLabel(label, this.labelerDefs);
    if (!labeler) return null;
    const labelDefinition = getDefinitionForLabel(label, labeler);
    if (!labelDefinition) return null;
    return { labelDefinition, labeler };
  }

  setContentLabelPref({ label, visibility, labelerDid }) {
    const clone = this.clone();
    const existingPref = clone.getContentLabelPref({ label, labelerDid });
    if (existingPref) {
      existingPref.visibility = visibility;
    } else {
      clone.obj.push({
        $type: "app.bsky.actor.defs#contentLabelPref",
        label,
        labelerDid,
        visibility,
      });
    }
    return clone;
  }

  getLabelerSettings(labelerDid) {
    const contentLabelPrefs = Preferences.getContentLabelPreferences(this.obj);
    return contentLabelPrefs.filter((pref) => pref.labelerDid === labelerDid);
  }

  _getBadgeLabelsFromLabels(labels, { includeBlurLabels = false } = {}) {
    const badgeLabels = [];
    for (const label of labels) {
      const labeler = getLabelerForLabel(label, this.labelerDefs);
      if (!labeler) continue;
      const labelDefinition = getDefinitionForLabel(label, labeler);
      if (!labelDefinition) continue;
      const rendersAsBadge =
        isBadgeLabel(labelDefinition) ||
        (includeBlurLabels &&
          ["alert", "inform"].includes(labelDefinition.severity));
      if (!rendersAsBadge) continue;
      const visibility = this.getLabelVisibility(label, labelDefinition);
      if (visibility === "ignore") continue;
      badgeLabels.push({
        visibility,
        label,
        labelDefinition,
        labeler,
      });
    }
    return badgeLabels;
  }

  getBadgeLabelsForPost(post) {
    return this._getBadgeLabelsFromLabels(getPostLabels(post));
  }

  getBadgeLabelsForProfile(profile) {
    // Blur labels on a post surface as its content warning, so only
    // blurs: "none" labels become pills there. A profile-targeted blur label
    // blurs the account's content/media, not the profile card, so it still
    // renders as a pill when its severity is alert/inform (mirrors
    // social-app's profileList/profileView behaviors).
    return this._getBadgeLabelsFromLabels(profile?.labels ?? [], {
      includeBlurLabels: true,
    });
  }

  _getLabelByBlurType(post, blurType) {
    const labels = getPostLabels(post);
    // Get label with the most restrictive visibility: "ignore" < "warn" < "hide"
    let currentLabel = null;
    for (const label of labels) {
      const result = this.getLabelDefinitionAndLabeler(label);
      if (!result) continue;
      const { labelDefinition, labeler } = result;
      if (labelDefinition.blurs !== blurType) continue;
      const labelVisibility = this.getLabelVisibility(label, labelDefinition);
      if (labelVisibility === "hide") {
        return { visibility: "hide", label, labelDefinition, labeler };
      }
      if (labelVisibility === "warn" && !currentLabel) {
        currentLabel = {
          visibility: labelVisibility,
          label,
          labelDefinition,
          labeler,
        };
      }
    }
    return currentLabel;
  }

  getContentLabel(post) {
    return this._getLabelByBlurType(post, "content");
  }

  getMediaLabel(post) {
    return this._getLabelByBlurType(post, "media");
  }

  getProfileBlurLabel(profileOrAuthor) {
    const labels = profileOrAuthor?.labels ?? [];
    let currentLabel = null;
    for (const label of labels) {
      const result = this.getLabelDefinitionAndLabeler(label);
      if (!result) continue;
      const { labelDefinition, labeler } = result;
      if (
        labelDefinition.blurs !== "content" &&
        labelDefinition.blurs !== "media"
      ) {
        continue;
      }
      const visibility = this.getLabelVisibility(label, labelDefinition);
      if (visibility === "ignore") continue;
      const entry = { visibility, label, labelDefinition, labeler };
      if (visibility === "hide") {
        return entry;
      }
      if (visibility === "warn" && !currentLabel) {
        currentLabel = entry;
      }
    }
    return currentLabel;
  }

  isPostHidden(postUri) {
    const hiddenPostsPreference = Preferences.getHiddenPostsPreference(
      this.obj,
    );
    if (!hiddenPostsPreference) {
      return false;
    }
    return hiddenPostsPreference.items.includes(postUri);
  }

  getMutedWords() {
    const mutedWordsPreference = Preferences.getMutedWordsPreference(this.obj);
    return mutedWordsPreference ? mutedWordsPreference.items : [];
  }

  addMutedWord({ value, targets, actorTarget, expiresAt }) {
    const clone = this.clone();
    let mutedWordsPreference = Preferences.getMutedWordsPreference(clone.obj);
    if (!mutedWordsPreference) {
      mutedWordsPreference = {
        $type: "app.bsky.actor.defs#mutedWordsPref",
        items: [],
      };
      clone.obj.push(mutedWordsPreference);
    }
    mutedWordsPreference.items.push({
      id: generateTid(),
      value,
      targets,
      actorTarget,
      expiresAt,
    });
    return clone;
  }

  removeMutedWord(wordId) {
    const clone = this.clone();
    const mutedWordsPreference = Preferences.getMutedWordsPreference(clone.obj);
    if (!mutedWordsPreference) {
      return clone;
    }
    mutedWordsPreference.items = mutedWordsPreference.items.filter(
      (item) => item.id !== wordId,
    );
    return clone;
  }

  updateMutedWord(wordId, updatedFields) {
    const clone = this.clone();
    const mutedWordsPreference = Preferences.getMutedWordsPreference(clone.obj);
    if (mutedWordsPreference) {
      mutedWordsPreference.items = mutedWordsPreference.items.map((item) =>
        item.id === wordId ? { ...item, ...updatedFields } : item,
      );
    }
    return clone;
  }

  hasMutedWord({ text, facets, embed, languages, author }) {
    const mutedWordsPreference = Preferences.getMutedWordsPreference(this.obj);
    if (!mutedWordsPreference) {
      return false;
    }
    const now = new Date().toISOString();
    const activeItems = mutedWordsPreference.items.filter((item) =>
      item.expiresAt ? item.expiresAt > now : true,
    );
    for (const item of activeItems) {
      if (
        item.actorTarget === "exclude-following" &&
        author?.viewer?.following
      ) {
        continue;
      }
      if (item.targets.includes("content")) {
        if (text && textMatchesMutedWord(text, item.value, languages)) {
          return true;
        }
        // Also look at alt text and external links
        if (embed) {
          const embedTextSnippets = getContentTextFromEmbed(embed);
          for (const embedTextSnippet of embedTextSnippets) {
            if (textMatchesMutedWord(embedTextSnippet, item.value, languages)) {
              return true;
            }
          }
        }
      }
      if (item.targets.includes("tag")) {
        const tagFacets = facets ? getTagsFromFacets(facets) : [];
        for (const tagFacet of tagFacets) {
          const tagText = tagFacet.features[0].tag;
          if (textMatchesMutedWord(tagText, item.value, languages)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  postHasMutedWord(post) {
    const text = post?.record?.text ?? null;
    const facets = post?.record?.facets ?? null;
    const embed = post?.record?.embed ?? null;
    const languages = post?.record?.langs ?? [];
    const author = post?.author ?? null;
    return this.hasMutedWord({ text, facets, embed, languages, author });
  }

  quotedPostHasMutedWord(quotedPost) {
    const text = quotedPost?.value?.text ?? null;
    const facets = quotedPost?.value?.facets ?? null;
    const embed = quotedPost?.value?.embed ?? null;
    const languages = quotedPost?.value?.langs ?? [];
    const author = quotedPost?.author ?? null;
    return this.hasMutedWord({ text, facets, embed, languages, author });
  }

  clone() {
    return new Preferences(deepClone(this.obj), deepClone(this.labelerDefs), {
      persist: this.persist,
    });
  }

  getPluginSettings(pluginId) {
    const pref = Preferences.getPluginSettingsPreference(this.obj, pluginId);
    return pref ? pref.data : null;
  }

  setPluginSettings(pluginId, data) {
    const clone = this.clone();
    const existing = Preferences.getPluginSettingsPreference(
      clone.obj,
      pluginId,
    );
    if (existing) {
      existing.data = data;
    } else {
      clone.obj.push({
        $type: PLUGIN_SETTINGS_PREF_TYPE,
        pluginId,
        data,
      });
    }
    return clone;
  }

  clearPluginSettings(pluginId) {
    const clone = this.clone();
    clone.obj = clone.obj.filter(
      (pref) =>
        !(
          pref.$type === PLUGIN_SETTINGS_PREF_TYPE && pref.pluginId === pluginId
        ),
    );
    return clone;
  }

  getInstalledPlugins() {
    const pref = Preferences.getPreferenceByType(
      this.obj,
      INSTALLED_PLUGINS_PREF_TYPE,
    );
    return pref?.plugins ?? [];
  }

  setInstalledPlugins(plugins) {
    const clone = this.clone();
    const existing = Preferences.getPreferenceByType(
      clone.obj,
      INSTALLED_PLUGINS_PREF_TYPE,
    );
    if (existing) {
      existing.plugins = plugins;
    } else {
      clone.obj.push({
        $type: INSTALLED_PLUGINS_PREF_TYPE,
        plugins,
      });
    }
    return clone;
  }

  getFollowingFeedPreference() {
    const followingFeedPreference = this.obj.find(
      (preference) =>
        preference.$type === "app.bsky.actor.defs#feedViewPref" &&
        preference.feed === "home",
    );
    return followingFeedPreference ?? null;
  }

  // Helpers

  static getPreferenceByType(obj, type) {
    return obj.find((preference) => preference.$type === type);
  }

  static getHiddenPostsPreference(obj) {
    // Note: social-app stores hidden posts in local storage,
    // but there's a note in the code to "move to the server" so let's just do that here.
    return Preferences.getPreferenceByType(obj, HIDDEN_POSTS_PREF_TYPE);
  }

  static getSearchHistoryPreference(obj) {
    // As with hidden posts, store these on preferences instead of locally.
    return Preferences.getPreferenceByType(obj, SEARCH_HISTORY_PREF_TYPE);
  }

  static ensureSearchHistoryPreference(obj) {
    let pref = Preferences.getSearchHistoryPreference(obj);
    if (!pref) {
      pref = {
        $type: SEARCH_HISTORY_PREF_TYPE,
        searches: [],
      };
      obj.push(pref);
    }
    return pref;
  }

  static getMutedWordsPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#mutedWordsPref",
    );
  }

  static getSavedFeedsPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#savedFeedsPrefV2",
    );
  }

  static getLabelerPreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#labelersPref",
    );
  }

  static getContentLabelPreferences(obj) {
    return obj.filter(
      (pref) => pref.$type === "app.bsky.actor.defs#contentLabelPref",
    );
  }

  static getPluginSettingsPreference(obj, pluginId) {
    return obj.find(
      (pref) =>
        pref.$type === PLUGIN_SETTINGS_PREF_TYPE && pref.pluginId === pluginId,
    );
  }

  static getLabelerDidsFromPreferences(obj) {
    const labelerPreference = Preferences.getLabelerPreference(obj);
    const labelers = labelerPreference ? labelerPreference.labelers : [];
    return labelers.map((labeler) => labeler.did).concat([BSKY_LABELER_DID]);
  }

  static createLoggedOutPreferences() {
    return new Preferences(
      [
        {
          $type: "app.bsky.actor.defs#savedFeedsPrefV2",
          items: [
            {
              id: "3l6ovcmm2vd2j",
              type: isListFeed(LOGGED_OUT_FEED_URI) ? "list" : "feed",
              value: LOGGED_OUT_FEED_URI,
              pinned: true,
            },
          ],
        },
      ],
      [],
      { persist: false },
    );
  }
}
