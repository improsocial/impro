import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";

const BSKY_LABELER_DID = "did:plc:ar7c4by46qjdydhdevvrndac";
const BSKY_ONLY_CATEGORIES = ["childSafety"];
const REPORT_CATEGORIES = [
  {
    key: "misleading",
    title: "Misleading",
    description: "Spam, impersonation, misinformation",
  },
  {
    key: "sexualContent",
    title: "Adult content",
    description: "Sexual or explicit content",
  },
  {
    key: "harassmentHate",
    title: "Harassment or hate",
    description: "Abuse, threats, discrimination",
  },
  {
    key: "violence",
    title: "Violence",
    description: "Graphic content, threats",
  },
  {
    key: "childSafety",
    title: "Child safety",
    description: "Content endangering children",
  },
  {
    key: "selfHarm",
    title: "Self-harm",
    description: "Self-harm or dangerous behaviors",
  },
  {
    key: "ruleBreaking",
    title: "Breaking site rules",
    description: "Terms violations, security issues",
  },
  { key: "other", title: "Other", description: "Other issues" },
];

const REASON_TYPES_BY_CATEGORY = {
  misleading: [
    { reasonType: "com.atproto.moderation.defs#reasonSpam", title: "Spam" },
    {
      reasonType: "com.atproto.moderation.defs#reasonMisleading",
      title: "Scam or fraud",
    },
    {
      reasonType: "com.atproto.moderation.defs#reasonMisleading",
      title: "Impersonation",
    },
    {
      reasonType: "com.atproto.moderation.defs#reasonOther",
      title: "Other misleading content",
    },
  ],
  sexualContent: [
    {
      reasonType: "com.atproto.moderation.defs#reasonSexual",
      title: "Unwanted sexual content",
    },
    { reasonType: "com.atproto.moderation.defs#reasonSexual", title: "Nudity" },
  ],
  harassmentHate: [
    {
      reasonType: "com.atproto.moderation.defs#reasonRude",
      title: "Anti-social behavior",
    },
    {
      reasonType: "com.atproto.moderation.defs#reasonRude",
      title: "Harassment",
    },
  ],
  violence: [
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Threatening violence",
    },
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Graphic violent content",
    },
  ],
  childSafety: [
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Child sexual abuse material",
    },
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Child endangerment",
    },
  ],
  selfHarm: [
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Self-harm or suicide",
    },
  ],
  ruleBreaking: [
    {
      reasonType: "com.atproto.moderation.defs#reasonViolation",
      title: "Terms of service violation",
    },
  ],
  other: [
    { reasonType: "com.atproto.moderation.defs#reasonOther", title: "Other" },
  ],
};

function stepIndicatorTemplate({ stepIndex, currentStepIndex }) {
  const isActive = stepIndex === currentStepIndex;
  const isCompleted = stepIndex < currentStepIndex;
  return html`
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
  `;
}

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

function stepTemplate({ stepIndex, currentStepIndex, title, children }) {
  const isActive = currentStepIndex === stepIndex;
  const isCompleted = currentStepIndex > stepIndex;

  return html`
    <div class="report-step ${isActive ? "active" : ""}">
      <div class="report-step-header">
        ${stepIndicatorTemplate({ stepIndex, currentStepIndex })}
        <div class="report-step-title ${isActive ? "active" : ""}">
          ${title}
        </div>
      </div>
      ${isActive || isCompleted
        ? html`<div class="report-step-content">${children}</div>`
        : null}
    </div>
  `;
}

function categoryStepTemplate({
  currentStepIndex,
  subjectType,
  selectedCategory,
  onSelectCategory,
  onClearCategory,
}) {
  return stepTemplate({
    stepIndex: 0,
    currentStepIndex,
    title: `Why should this ${getDisplayNameForSubjectType(subjectType)} be reviewed?`,
    children:
      selectedCategory && currentStepIndex > 0
        ? selectedItemTemplate({
            title: selectedCategory.title,
            onClear: onClearCategory,
          })
        : html`
            <div class="report-options">
              ${REPORT_CATEGORIES.map((category) =>
                categoryCardTemplate({
                  category,
                  onClick: () => onSelectCategory(category),
                }),
              )}
            </div>
          `,
  });
}

function reasonTypeStepTemplate({
  currentStepIndex,
  selectedCategory,
  selectedReasonType,
  onSelectReasonType,
  onClearReasonType,
}) {
  const reasonTypes = REASON_TYPES_BY_CATEGORY[selectedCategory?.key] || [];
  return stepTemplate({
    stepIndex: 1,
    currentStepIndex,
    title: "Select a reason",
    children:
      selectedReasonType && currentStepIndex > 1
        ? selectedItemTemplate({
            title: selectedReasonType.title,
            onClear: onClearReasonType,
          })
        : html`
            <div class="report-options">
              ${reasonTypes.map((reasonType) =>
                reasonTypeCardTemplate({
                  reasonType,
                  onClick: () => onSelectReasonType(reasonType),
                }),
              )}
            </div>
          `,
  });
}

function labelerStepTemplate({
  currentStepIndex,
  subjectType,
  selectedCategory,
  selectedReasonType,
  selectedLabeler,
  labelerDefs,
  onSelectLabeler,
  onClearLabeler,
}) {
  let children;
  if (selectedLabeler && currentStepIndex > 2) {
    const labelerTitle =
      selectedLabeler.creator.displayName || selectedLabeler.creator.handle;
    children = selectedItemTemplate({
      title: labelerTitle,
      onClear: onClearLabeler,
    });
  } else {
    const labelers = getLabelersForSelections(
      selectedCategory,
      selectedReasonType,
      labelerDefs,
      subjectType,
    );
    if (labelers.length === 0) {
      children = html`<div class="report-no-labelers">
        No moderation services are available for this type of report.
      </div>`;
    } else {
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
      children = html`
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
  }

  return stepTemplate({
    stepIndex: 2,
    currentStepIndex,
    title: "Select moderation service",
    children,
  });
}

function submitStepTemplate({
  currentStepIndex,
  selectedLabeler,
  details,
  error,
  isSubmitting,
  onDetailsInput,
  onSubmit,
}) {
  const labelerName =
    selectedLabeler?.creator.displayName || selectedLabeler?.creator.handle;

  return stepTemplate({
    stepIndex: 3,
    currentStepIndex,
    title: "Submit report",
    children: html`
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
    `,
  });
}

function getLabelersForSelections(
  selectedCategory,
  selectedReasonType,
  labelerDefs,
  subjectType,
) {
  // Handle bluesky-only categories
  if (BSKY_ONLY_CATEGORIES.includes(selectedCategory?.key)) {
    const bskyLabeler = labelerDefs.find((labelerDefinition) => {
      return labelerDefinition.creator.did === BSKY_LABELER_DID;
    });
    if (!bskyLabeler) {
      throw new Error("Bluesky labeler definition not found");
    }
    return [bskyLabeler];
  }
  return labelerDefs.filter((labelerDefinition) => {
    // Filter by supported subject type
    const supportedSubjectTypes = labelerDefinition.subjectTypes;
    if (supportedSubjectTypes && !supportedSubjectTypes.includes(subjectType)) {
      return false;
    }
    // Filter by reason type
    if (selectedReasonType) {
      const supportedReasonTypes = labelerDefinition.reasonTypes;
      if (
        supportedReasonTypes &&
        !supportedReasonTypes.includes(selectedReasonType.reasonType)
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
              ${categoryStepTemplate({
                currentStepIndex,
                subjectType,
                selectedCategory: this._selectedCategory,
                onSelectCategory: (category) => this.selectCategory(category),
                onClearCategory: () => this.clearCategory(),
              })}
              ${reasonTypeStepTemplate({
                currentStepIndex,
                selectedCategory: this._selectedCategory,
                selectedReasonType: this._selectedReasonType,
                onSelectReasonType: (reasonType) =>
                  this.selectReasonType(reasonType),
                onClearReasonType: () => this.clearReasonType(),
              })}
              ${labelerStepTemplate({
                currentStepIndex,
                subjectType,
                selectedCategory: this._selectedCategory,
                selectedReasonType: this._selectedReasonType,
                selectedLabeler: this._selectedLabeler,
                labelerDefs: this.labelerDefs,
                onSelectLabeler: (labeler) => this.selectLabeler(labeler),
                onClearLabeler: () => this.clearLabeler(),
              })}
              ${submitStepTemplate({
                currentStepIndex,
                selectedLabeler: this._selectedLabeler,
                details: this._details,
                error: this._error,
                isSubmitting: this._isSubmitting,
                onDetailsInput: (e) => {
                  this._details = e.target.value;
                },
                onSubmit: () => this.submit(),
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

    this.dispatchEvent(
      new CustomEvent("submit-report", {
        detail: {
          reasonType: this._selectedReasonType.reasonType,
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
