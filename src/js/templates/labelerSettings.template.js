import { html } from "/js/lib/lit-html.js";
import { classnames, noop } from "/js/utils.js";

function getLabelNameAndDescription(labelDef, preferredLang = "en") {
  const defaultName = labelDef.identifier;
  if (!labelDef.locales || labelDef.locales.length === 0) {
    return { name: defaultName, description: "" };
  }
  const locale =
    labelDef.locales.find((l) => l.lang === preferredLang) ||
    labelDef.locales[0];
  return {
    name: locale.name || defaultName,
    description: locale.description || "",
  };
}

function getWarnButtonConfig(labelDef) {
  const blurs = labelDef.blurs || "none";
  const severity = labelDef.severity || "none";
  if (blurs === "content" || blurs === "media") {
    return { showWarn: true, warnLabel: "Warn" };
  }
  if (severity === "alert") {
    return { showWarn: true, warnLabel: "Warn" };
  }
  if (severity === "inform") {
    return { showWarn: true, warnLabel: "Show badge" };
  }
  return { showWarn: false, warnLabel: "" };
}

function getDefaultValue(labelDef) {
  const defaultValue = labelDef.defaultSetting;
  if (!defaultValue || !["ignore", "warn", "hide"].includes(defaultValue)) {
    return "warn";
  }
  return defaultValue;
}

function labelPreferenceRowTemplate({
  labelDef,
  value,
  isSubscribed,
  onClick,
}) {
  const { name, description } = getLabelNameAndDescription(labelDef);
  const { showWarn, warnLabel } = getWarnButtonConfig(labelDef);
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
              ${showWarn
                ? html`
                    <button
                      class=${classnames("label-pref-button", {
                        active: value === "warn",
                      })}
                      @click=${() => onClick("warn")}
                    >
                      ${warnLabel}
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
        ${configurableLabels.map((labelDef) => {
          const currentSetting = labelerSettings.find(
            (pref) => pref.label === labelDef.identifier,
          );
          const value = currentSetting
            ? currentSetting.visibility
            : getDefaultValue(labelDef);
          return labelPreferenceRowTemplate({
            labelDef,
            value,
            isSubscribed,
            onClick: (newValue) => {
              if (newValue !== value) {
                onClick(labelDef.identifier, newValue);
              }
            },
          });
        })}
      </div>
    </div>
  `;
}
