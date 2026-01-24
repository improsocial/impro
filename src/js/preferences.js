import { getPostLabels } from "/js/dataHelpers.js";
import { deepClone } from "/js/utils.js";
import { DISCOVER_FEED_URI } from "/js/config.js";
import { getTagsFromFacets } from "/js/facetHelpers.js";

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

function getLabelerForLabel(label, labelers) {
  const matchingLabeler = labelers.find(
    (labeler) => labeler.creator.did === label.src,
  );
  return matchingLabeler ?? null;
}

function getDefinitionForLabel(label, labeler) {
  return labeler.policies.labelValueDefinitions.find(
    (definition) => definition.identifier === label.val,
  );
}

function getDisplayNameForLabel(label, labeler) {
  const matchingDefinition = getDefinitionForLabel(label, labeler);
  if (!matchingDefinition) {
    return null;
  }
  const enLocale = matchingDefinition.locales.find(
    (locale) => locale.lang === "en",
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

  hidePost(postUri) {
    const clone = this.clone();
    let hiddenPostsPreference = Preferences.getHiddenPostsPreference(clone.obj);
    // If the preference doesn't exist, create it
    if (!hiddenPostsPreference) {
      hiddenPostsPreference = {
        $type: "app.bsky.actor.defs#improHiddenPostsPref",
        items: [],
      };
      clone.obj.push(hiddenPostsPreference);
    }
    hiddenPostsPreference.items.push(postUri);
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

  isSubscribedToLabeler(did) {
    const labelerPreference = Preferences.getLabelerPreference(this.obj);
    if (!labelerPreference) {
      return false;
    }
    return labelerPreference.labelers.some((labeler) => labeler.did === did);
  }

  subscribeLabeler(did) {
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
    return clone;
  }

  getContentLabelPref({ label, labelerDid }) {
    const contentLabelPrefs = Preferences.getContentLabelPreferences(this.obj);
    const matchingPref = contentLabelPrefs.find(
      (pref) => pref.label === label && pref.labelerDid === labelerDid,
    );
    return matchingPref ?? null;
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

  isPostHidden(postUri) {
    const hiddenPostsPreference = Preferences.getHiddenPostsPreference(
      this.obj,
    );
    if (!hiddenPostsPreference) {
      return false;
    }
    return hiddenPostsPreference.items.includes(postUri);
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
      if (item.targets.includes("tags")) {
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

  // Todo - memoize this?
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
    return new Preferences(deepClone(this.obj), deepClone(this.labelerDefs));
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
    // Note: This is a custom preference type. social-app stores hidden posts in local storage,
    // but there's a note in the code to "move to the server" so let's just do that here.
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#improHiddenPostsPref",
    );
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

  static getImproThemePreference(obj) {
    return Preferences.getPreferenceByType(
      obj,
      "app.bsky.actor.defs#improThemePref",
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
      [],
    );
  }
}
