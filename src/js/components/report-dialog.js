import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";

const BSKY_LABELER_DID = "did:plc:ar7c4by46qjdydhdevvrndac";
const BSKY_ONLY_CATEGORIES = ["childSafety"];
const BSKY_ONLY_REASON_TYPES = [
  "tools.ozone.report.defs#reasonViolenceExtremistContent",
];

// Maps new Ozone reason types to old types for backwards compatibility
const NEW_TO_OLD_REASONS_MAP = {
  "tools.ozone.report.defs#reasonAppeal":
    "com.atproto.moderation.defs#reasonAppeal",
  "tools.ozone.report.defs#reasonOther":
    "com.atproto.moderation.defs#reasonOther",
  "tools.ozone.report.defs#reasonViolenceAnimal":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceThreats":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceGraphicContent":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceGlorification":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceExtremistContent":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceTrafficking":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonViolenceOther":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSexualAbuseContent":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonSexualNCII":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonSexualDeepfake":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonSexualAnimal":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonSexualUnlabeled":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonSexualOther":
    "com.atproto.moderation.defs#reasonSexual",
  "tools.ozone.report.defs#reasonChildSafetyCSAM":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonChildSafetyGroom":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonChildSafetyPrivacy":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonChildSafetyHarassment":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonChildSafetyOther":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonHarassmentTroll":
    "com.atproto.moderation.defs#reasonRude",
  "tools.ozone.report.defs#reasonHarassmentTargeted":
    "com.atproto.moderation.defs#reasonRude",
  "tools.ozone.report.defs#reasonHarassmentHateSpeech":
    "com.atproto.moderation.defs#reasonRude",
  "tools.ozone.report.defs#reasonHarassmentDoxxing":
    "com.atproto.moderation.defs#reasonRude",
  "tools.ozone.report.defs#reasonHarassmentOther":
    "com.atproto.moderation.defs#reasonRude",
  "tools.ozone.report.defs#reasonMisleadingBot":
    "com.atproto.moderation.defs#reasonMisleading",
  "tools.ozone.report.defs#reasonMisleadingImpersonation":
    "com.atproto.moderation.defs#reasonMisleading",
  "tools.ozone.report.defs#reasonMisleadingSpam":
    "com.atproto.moderation.defs#reasonSpam",
  "tools.ozone.report.defs#reasonMisleadingScam":
    "com.atproto.moderation.defs#reasonMisleading",
  "tools.ozone.report.defs#reasonMisleadingElections":
    "com.atproto.moderation.defs#reasonMisleading",
  "tools.ozone.report.defs#reasonMisleadingOther":
    "com.atproto.moderation.defs#reasonMisleading",
  "tools.ozone.report.defs#reasonRuleSiteSecurity":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonRuleProhibitedSales":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonRuleBanEvasion":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonRuleOther":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSelfHarmContent":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSelfHarmED":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSelfHarmStunts":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSelfHarmSubstances":
    "com.atproto.moderation.defs#reasonViolation",
  "tools.ozone.report.defs#reasonSelfHarmOther":
    "com.atproto.moderation.defs#reasonViolation",
};

const REPORT_CATEGORIES = [
  {
    key: "misleading",
    title: "Misleading",
    description: "Spam or other inauthentic behavior or deception",
  },
  {
    key: "sexualContent",
    title: "Adult content",
    description: "Unlabeled, abusive, or non-consensual adult content",
  },
  {
    key: "harassmentHate",
    title: "Harassment or hate",
    description: "Abusive or discriminatory behavior",
  },
  {
    key: "violence",
    title: "Violence",
    description: "Violent or threatening content",
  },
  {
    key: "childSafety",
    title: "Child safety",
    description: "Harming or endangering minors",
  },
  {
    key: "selfHarm",
    title: "Self-harm",
    description: "Harmful or high-risk activities",
  },
  {
    key: "ruleBreaking",
    title: "Breaking site rules",
    description: "Banned activities or security violations",
  },
  {
    key: "other",
    title: "Other",
    description: "An issue not included in these options",
  },
];

const REASON_TYPES_BY_CATEGORY = {
  misleading: [
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingScam",
      title: "Scam",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingBot",
      title: "Fake account or bot",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingImpersonation",
      title: "Impersonation",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingElections",
      title: "False information about elections",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonMisleadingOther",
      title: "Other misleading content",
    },
  ],
  sexualContent: [
    {
      reasonType: "tools.ozone.report.defs#reasonSexualUnlabeled",
      title: "Unlabeled adult content",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSexualAbuseContent",
      title: "Adult sexual abuse content",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSexualNCII",
      title: "Non-consensual intimate imagery",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSexualDeepfake",
      title: "Deepfake adult content",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSexualAnimal",
      title: "Animal sexual abuse",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSexualOther",
      title: "Other sexual violence content",
    },
  ],
  harassmentHate: [
    {
      reasonType: "tools.ozone.report.defs#reasonHarassmentTroll",
      title: "Trolling",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonHarassmentTargeted",
      title: "Targeted harassment",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonHarassmentHateSpeech",
      title: "Hate speech",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonHarassmentDoxxing",
      title: "Doxxing",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonHarassmentOther",
      title: "Other harassing or hateful content",
    },
  ],
  violence: [
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceAnimal",
      title: "Animal welfare",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceThreats",
      title: "Threats or incitement",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceGraphicContent",
      title: "Graphic violent content",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceGlorification",
      title: "Glorification of violence",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceExtremistContent",
      title: "Extremist content",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceTrafficking",
      title: "Human trafficking",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonViolenceOther",
      title: "Other violent content",
    },
  ],
  childSafety: [
    {
      reasonType: "tools.ozone.report.defs#reasonChildSafetyCSAM",
      title: "Child Sexual Abuse Material (CSAM)",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonChildSafetyGroom",
      title: "Grooming or predatory behavior",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonChildSafetyPrivacy",
      title: "Privacy violation of a minor",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonChildSafetyHarassment",
      title: "Minor harassment or bullying",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonChildSafetyOther",
      title: "Other child safety issue",
    },
  ],
  selfHarm: [
    {
      reasonType: "tools.ozone.report.defs#reasonSelfHarmContent",
      title: "Content promoting or depicting self-harm",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSelfHarmED",
      title: "Eating disorders",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSelfHarmStunts",
      title: "Dangerous challenges or activities",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSelfHarmSubstances",
      title: "Dangerous substances or drug abuse",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonSelfHarmOther",
      title: "Other dangerous content",
    },
  ],
  ruleBreaking: [
    {
      reasonType: "tools.ozone.report.defs#reasonRuleSiteSecurity",
      title: "Hacking or system attacks",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonRuleProhibitedSales",
      title: "Promoting or selling prohibited items or services",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonRuleBanEvasion",
      title: "Banned user returning",
    },
    {
      reasonType: "tools.ozone.report.defs#reasonRuleOther",
      title: "Other network rule-breaking",
    },
  ],
  other: [
    { reasonType: "tools.ozone.report.defs#reasonOther", title: "Other" },
  ],
};

function categoryCardTemplate({ category, onClick }) {
  return html`
    <button class="report-option-card" @click=${onClick}>
      <div class="report-option-title">${category.title}</div>
      <div class="report-option-description">${category.description}</div>
    </button>
  `;
}

function reasonTypeCardTemplate({ reasonType, onClick }) {
  return html`
    <button class="report-option-card" @click=${onClick}>
      <div class="report-option-title">${reasonType.title}</div>
    </button>
  `;
}

function labelerCardTemplate({ labeler, onClick }) {
  const title = labeler.creator.displayName || labeler.creator.handle;
  return html`
    <button class="report-option-card report-labeler-card" @click=${onClick}>
      <div class="report-labeler-avatar">
        ${avatarTemplate({ author: labeler.creator, clickAction: "none" })}
      </div>
      <div class="report-labeler-info">
        <div class="report-option-title">${title}</div>
        <div class="report-option-description">@${labeler.creator.handle}</div>
      </div>
    </button>
  `;
}

function selectedItemTemplate({ title, onClear }) {
  return html`
    <div class="report-selected-item">
      <span class="report-selected-title">${title}</span>
      <button class="report-selected-clear" @click=${onClear}>&times;</button>
    </div>
  `;
}

function getDisplayNameForSubjectType(subjectType) {
  switch (subjectType) {
    case "post":
      return "post";
    case "account":
      return "account";
    default:
      throw new Error(`Invalid subject type: ${subjectType}`);
  }
}

function stepTemplate({ stepIndex, currentStepIndex, title, renderStep }) {
  const isActive = currentStepIndex === stepIndex;
  const isCompleted = currentStepIndex > stepIndex;
  return html`
    <div class="report-step ${isActive ? "active" : ""}">
      <div class="report-step-header">
        <div
          class="report-step-indicator ${isActive
            ? "active"
            : isCompleted
              ? "completed"
              : ""}"
        >
          ${isCompleted
            ? html`<span class="checkmark">&#10003;</span>`
            : stepIndex + 1}
        </div>
        <div class="report-step-title ${isActive ? "active" : ""}">
          ${title}
        </div>
      </div>
      ${isActive || isCompleted
        ? html`<div class="report-step-content">
            ${renderStep({ isActive, isCompleted })}
          </div>`
        : null}
    </div>
  `;
}

function categoryStepTemplate({
  isCompleted,
  selectedCategory,
  onSelectCategory,
  onClearCategory,
}) {
  if (isCompleted) {
    return selectedItemTemplate({
      title: selectedCategory.title,
      onClear: onClearCategory,
    });
  }
  return html`
    <div class="report-options">
      ${REPORT_CATEGORIES.map((category) =>
        categoryCardTemplate({
          category,
          onClick: () => onSelectCategory(category),
        }),
      )}
    </div>
  `;
}

function reasonTypeStepTemplate({
  isCompleted,
  selectedCategory,
  selectedReasonType,
  onSelectReasonType,
  onClearReasonType,
}) {
  if (isCompleted) {
    return selectedItemTemplate({
      title: selectedReasonType.title,
      onClear: onClearReasonType,
    });
  }
  const reasonTypes = REASON_TYPES_BY_CATEGORY[selectedCategory.key];
  return html`
    <div class="report-options">
      ${reasonTypes.map((reasonType) =>
        reasonTypeCardTemplate({
          reasonType,
          onClick: () => onSelectReasonType(reasonType),
        }),
      )}
    </div>
  `;
}

function labelerStepTemplate({
  isCompleted,
  subjectType,
  selectedCategory,
  selectedReasonType,
  selectedLabeler,
  labelerDefs,
  onSelectLabeler,
  onClearLabeler,
}) {
  if (isCompleted) {
    const labelerTitle =
      selectedLabeler.creator.displayName || selectedLabeler.creator.handle;
    return selectedItemTemplate({
      title: labelerTitle,
      onClear: onClearLabeler,
    });
  }
  const labelers = getLabelersForSelections(
    selectedCategory,
    selectedReasonType,
    labelerDefs,
    subjectType,
  );
  if (labelers.length === 0) {
    return html`<div class="report-no-labelers">
      No moderation services are available for this type of report.
    </div>`;
  }
  // Put the Bluesky labeler first
  const sortedLabelers = labelers.sort((a, b) => {
    if (a.creator.did === BSKY_LABELER_DID) {
      return -1;
    }
    if (b.creator.did === BSKY_LABELER_DID) {
      return 1;
    }
    return 0;
  });
  return html`
    <div class="report-options">
      ${sortedLabelers.map((labeler) =>
        labelerCardTemplate({
          labeler,
          onClick: () => onSelectLabeler(labeler),
        }),
      )}
    </div>
  `;
}

function submitStepTemplate({
  selectedLabeler,
  details,
  error,
  isSubmitting,
  onDetailsInput,
  onSubmit,
}) {
  const labelerName =
    selectedLabeler?.creator.displayName || selectedLabeler?.creator.handle;

  return html`
    <div class="report-submit-section">
      <p class="report-submit-info">
        Your report will be sent to <strong>${labelerName}</strong>.
      </p>

      <div class="report-details-section">
        <label for="report-details">Additional details (optional)</label>
        <textarea
          id="report-details"
          class="report-details-input"
          placeholder="Provide any additional context..."
          maxlength="300"
          .value=${details}
          @input=${onDetailsInput}
        ></textarea>
        <div class="report-details-counter">${details.length}/300</div>
      </div>
      <button
        class="rounded-button rounded-button-primary report-submit-button"
        @click=${onSubmit}
        ?disabled=${isSubmitting}
      >
        ${isSubmitting ? "Submitting..." : "Submit report"}
      </button>
      ${error ? html`<div class="report-error">${error}</div>` : null}
    </div>
  `;
}

function labelerSupportsSubjectType(labeler, subjectType) {
  if (!labeler.subjectTypes) {
    return true;
  }
  return labeler.subjectTypes.includes(subjectType);
}

function labelerSupportsReasonType(labeler, reasonType) {
  if (!labeler.reasonTypes) {
    return true;
  }
  return labeler.reasonTypes.includes(reasonType);
}

function getLegacyReasonType(reasonType) {
  return NEW_TO_OLD_REASONS_MAP[reasonType] || null;
}

// Returns the appropriate reason type for the labeler (falls back to old type if needed)
function getReasonTypeForLabeler(reasonType, labeler) {
  if (labelerSupportsReasonType(labeler, reasonType)) {
    return reasonType;
  } else {
    const oldReasonType = getLegacyReasonType(reasonType);
    if (!labelerSupportsReasonType(labeler, oldReasonType)) {
      // this should never happen, since we only show labelers that support the reason type
      throw new Error(
        `Labeler ${labeler.creator.did} does not support reason type ${reasonType}`,
      );
    }
    return oldReasonType;
  }
}

function getLabelersForSelections(
  selectedCategory,
  selectedReasonType,
  labelerDefs,
  subjectType,
) {
  // Handle bluesky-only categories and reason types
  if (
    BSKY_ONLY_CATEGORIES.includes(selectedCategory.key) ||
    BSKY_ONLY_REASON_TYPES.includes(selectedReasonType.reasonType)
  ) {
    const bskyLabeler = labelerDefs.find(
      (l) => l.creator.did === BSKY_LABELER_DID,
    );
    if (!bskyLabeler) {
      throw new Error("Bluesky labeler definition not found");
    }
    return [bskyLabeler];
  }
  return labelerDefs.filter((labelerDefinition) => {
    if (!labelerSupportsSubjectType(labelerDefinition, subjectType)) {
      return false;
    }
    if (
      !labelerSupportsReasonType(
        labelerDefinition,
        selectedReasonType.reasonType,
      )
    ) {
      // check legacy reason types
      const oldReasonType = getLegacyReasonType(selectedReasonType.reasonType);
      if (
        !oldReasonType ||
        !labelerSupportsReasonType(labelerDefinition, oldReasonType)
      ) {
        return false;
      }
    }
    return true;
  });
}

class ReportDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
    this.innerHTML = "";
    this._stepIndex = 0;
    this._selectedCategory = null;
    this._selectedReasonType = null;
    this._selectedLabeler = null;
    this._details = "";
    this._isSubmitting = false;
    this._error = null;
    this.render();
    this.initialized = true;
  }

  render() {
    const currentStepIndex = this._stepIndex;
    const subjectType = this.subjectType;
    render(
      html`
        <dialog
          class="report-dialog"
          @click=${(e) => {
            if (e.target.tagName === "DIALOG") {
              this.close();
            }
          }}
          @cancel=${(e) => {
            e.preventDefault();
            this.close();
          }}
        >
          <div class="report-dialog-content">
            <button class="report-dialog-close" @click=${() => this.close()}>
              &times;
            </button>
            <div class="report-dialog-body">
              ${stepTemplate({
                stepIndex: 0,
                currentStepIndex,
                title: `Why should this ${getDisplayNameForSubjectType(subjectType)} be reviewed?`,
                renderStep: ({ isCompleted }) =>
                  categoryStepTemplate({
                    isCompleted,
                    selectedCategory: this._selectedCategory,
                    onSelectCategory: (category) =>
                      this.selectCategory(category),
                    onClearCategory: () => this.clearCategory(),
                  }),
              })}
              ${stepTemplate({
                stepIndex: 1,
                currentStepIndex,
                title: "Select a reason",
                renderStep: ({ isCompleted }) =>
                  reasonTypeStepTemplate({
                    isCompleted,
                    selectedCategory: this._selectedCategory,
                    selectedReasonType: this._selectedReasonType,
                    onSelectReasonType: (reasonType) =>
                      this.selectReasonType(reasonType),
                    onClearReasonType: () => this.clearReasonType(),
                  }),
              })}
              ${stepTemplate({
                stepIndex: 2,
                currentStepIndex,
                title: "Select moderation service",
                renderStep: ({ isCompleted }) =>
                  labelerStepTemplate({
                    isCompleted,
                    subjectType,
                    selectedCategory: this._selectedCategory,
                    selectedReasonType: this._selectedReasonType,
                    selectedLabeler: this._selectedLabeler,
                    labelerDefs: this.labelerDefs,
                    onSelectLabeler: (labeler) => this.selectLabeler(labeler),
                    onClearLabeler: () => this.clearLabeler(),
                  }),
              })}
              ${stepTemplate({
                stepIndex: 3,
                currentStepIndex,
                title: "Submit report",
                renderStep: () =>
                  submitStepTemplate({
                    selectedLabeler: this._selectedLabeler,
                    details: this._details,
                    error: this._error,
                    isSubmitting: this._isSubmitting,
                    onDetailsInput: (e) => {
                      this._details = e.target.value;
                    },
                    onSubmit: () => this.submit(),
                  }),
              })}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  selectCategory(category) {
    this._selectedCategory = category;
    this._stepIndex = 1;
    this.render();
  }

  clearCategory() {
    this._selectedCategory = null;
    // Also clear reason type and labeler
    this._selectedReasonType = null;
    this._selectedLabeler = null;
    this._stepIndex = 0;
    this.render();
  }

  selectReasonType(reasonType) {
    this._selectedReasonType = reasonType;
    this._stepIndex = 2;
    this.render();
  }

  clearReasonType() {
    this._selectedReasonType = null;
    // Also clear labeler
    this._selectedLabeler = null;
    this._stepIndex = 1;
    this.render();
  }

  selectLabeler(labeler) {
    this._selectedLabeler = labeler;
    this._stepIndex = 3;
    this.render();
  }

  clearLabeler() {
    this._selectedLabeler = null;
    this._stepIndex = 2;
    this.render();
  }

  submit() {
    this._isSubmitting = true;
    this._error = null;
    this.render();

    const successCallback = () => {
      this.close();
    };

    const errorCallback = () => {
      this._isSubmitting = false;
      this._error = "Something went wrong. Please try again.";
      this.render();
    };

    const reasonType = getReasonTypeForLabeler(
      this._selectedReasonType.reasonType,
      this._selectedLabeler,
    );
    this.dispatchEvent(
      new CustomEvent("submit-report", {
        detail: {
          reasonType,
          labelerDid: this._selectedLabeler.creator.did,
          details: this._details,
          successCallback,
          errorCallback,
        },
      }),
    );
  }

  open() {
    this.scrollLock.lock();
    const dialog = this.querySelector(".report-dialog");
    dialog.showModal();
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".report-dialog");
    dialog.close();
    this.dispatchEvent(new CustomEvent("report-dialog-closed"));
  }
}

ReportDialog.register();
