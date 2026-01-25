import { html } from "/js/lib/lit-html.js";
import {
  getLabelNameAndDescription,
  isBadgeLabel,
  getDefaultLabelSetting,
} from "/js/dataHelpers.js";
import { classnames, noop } from "/js/utils.js";

function doShowWarnButton(labelDefinition) {
  return !(
    labelDefinition.blurs === "none" && labelDefinition.severity === "none"
  );
}

function getWarnLabel(labelDefinition) {
  if (!isBadgeLabel(labelDefinition)) {
    return "Warn";
  }
  return labelDefinition.severity === "inform" ? "Show badge" : "Warn";
}

function labelPreferenceRowTemplate({
  labelDefinition,
  value,
  isSubscribed,
  onClick,
}) {
  const { name, description } = getLabelNameAndDescription(labelDefinition);
  const showWarnButton = doShowWarnButton(labelDefinition);
  return html`
    <div class="label-preference-row">
      <div class="label-preference-name">${name}</div>
      ${description
        ? html`<div class="label-preference-description">${description}</div>`
        : null}
      ${isSubscribed
        ? html`
            <div class="label-preference-buttons">
              <button
                class=${classnames("label-pref-button", {
                  active: value === "ignore",
                })}
                @click=${() => onClick("ignore")}
              >
                Off
              </button>
              ${showWarnButton
                ? html`
                    <button
                      class=${classnames("label-pref-button", {
                        active: value === "warn",
                      })}
                      @click=${() => onClick("warn")}
                    >
                      ${getWarnLabel(labelDefinition)}
                    </button>
                  `
                : null}
              <button
                class=${classnames("label-pref-button", {
                  active: value === "hide",
                })}
                @click=${() => onClick("hide")}
              >
                Hide
              </button>
            </div>
          `
        : null}
    </div>
  `;
}

export function labelerSettingsTemplate({
  labelerInfo,
  isSubscribed,
  labelerSettings,
  onClick = noop,
}) {
  const labelValueDefinitions =
    labelerInfo.policies?.labelValueDefinitions || [];
  const configurableLabels = labelValueDefinitions.filter(
    (def) => !def.identifier.startsWith("!"),
  );
  if (configurableLabels.length === 0) {
    return html`
      <div class="labeler-settings-container">
        <div class="labeler-settings-header">
          <p>This labeler has no configurable labels.</p>
        </div>
      </div>
    `;
  }
  return html`
    <div class="labeler-settings-container">
      <div class="labeler-settings-header">
        <p>
          Labels are annotations on users and content. They can be used to hide,
          warn, and categorize the network.
        </p>
      </div>
      <div class="label-preference-list">
        ${configurableLabels.map((labelDefinition) => {
          const currentSetting = labelerSettings.find(
            (pref) => pref.label === labelDefinition.identifier,
          );
          const value = currentSetting
            ? currentSetting.visibility
            : getDefaultLabelSetting(labelDefinition);
          return labelPreferenceRowTemplate({
            labelDefinition,
            value,
            isSubscribed,
            onClick: (newValue) => {
              if (newValue !== value) {
                onClick(labelDefinition.identifier, newValue);
              }
            },
          });
        })}
      </div>
    </div>
  `;
}
