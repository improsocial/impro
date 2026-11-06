import {
  getPostLabels,
  getLabelerForLabel,
  getDefinitionForLabel,
  isBadgeLabel,
  getGlobalLabelDefinition,
  getDefaultLabelSetting,
  isGlobalLabel,
} from "/js/dataHelpers.js";

// Locked (no-override) labels outrank user-revealable hides, which outrank warns
function getBlurEntryRank(entry) {
  if (entry.noOverride) return 2;
  return entry.visibility === "hide" ? 1 : 0;
}

// Label moderation helper class
export class Labeling {
  constructor(preferences, labelerDefs) {
    this.preferences = preferences;
    this.labelerDefs = labelerDefs;
  }

  getLabelVisibility(label, labelDefinition) {
    // Non-configurable global labels always use their default
    if (labelDefinition.configurable === false) {
      return getDefaultLabelSetting(labelDefinition);
    }
    if (this.isAdultLabelDisabled(labelDefinition)) {
      return "hide";
    }
    const pref = this.preferences.getContentLabelPref({
      label: label.val,
      labelerDid: isGlobalLabel(label.val) ? null : label.src,
    });
    return pref?.visibility ?? getDefaultLabelSetting(labelDefinition);
  }

  isAdultLabelDisabled(labelDefinition) {
    return (
      !!labelDefinition.adultOnly && !this.preferences.isAdultContentEnabled()
    );
  }

  _createBlurLabelEntry(visibility, label, labelDefinition, labeler) {
    return {
      visibility,
      label,
      labelDefinition,
      labeler,
      noOverride: this.isAdultLabelDisabled(labelDefinition),
    };
  }

  getLabelDefinitionAndLabeler(label) {
    const labeler = getLabelerForLabel(label, this.labelerDefs);
    // First check global labels
    const globalDef = getGlobalLabelDefinition(label.val);
    if (globalDef) {
      return { labelDefinition: globalDef, labeler };
    }
    // Then check labeler-defined labels
    if (!labeler) return null;
    const labelDefinition = getDefinitionForLabel(label, labeler);
    if (!labelDefinition) return null;
    return { labelDefinition, labeler };
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
      if (labelVisibility !== "hide" && labelVisibility !== "warn") continue;
      const entry = this._createBlurLabelEntry(
        labelVisibility,
        label,
        labelDefinition,
        labeler,
      );
      if (entry.noOverride) {
        return entry;
      }
      if (
        !currentLabel ||
        getBlurEntryRank(entry) > getBlurEntryRank(currentLabel)
      ) {
        currentLabel = entry;
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
      if (visibility !== "hide" && visibility !== "warn") continue;
      const entry = this._createBlurLabelEntry(
        visibility,
        label,
        labelDefinition,
        labeler,
      );
      if (entry.noOverride) {
        return entry;
      }
      if (
        !currentLabel ||
        getBlurEntryRank(entry) > getBlurEntryRank(currentLabel)
      ) {
        currentLabel = entry;
      }
    }
    return currentLabel;
  }

  hasHideLabel(labels) {
    return labels.some((label) => {
      const result = this.getLabelDefinitionAndLabeler(label);
      if (!result) return false;
      return this.getLabelVisibility(label, result.labelDefinition) === "hide";
    });
  }
}
