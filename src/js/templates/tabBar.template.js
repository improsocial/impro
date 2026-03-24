import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

export function tabBarTemplate({ tabs, activeTab, onTabClick }) {
  return html`
    <div class="tab-bar">
      ${tabs.map(
        (tab) =>
          html`<button
            class=${classnames("tab-bar-button", {
              active: activeTab === tab.value,
            })}
            @click=${() => onTabClick(tab.value)}
          >
            <span class="tab-bar-button-label">${tab.label}</span>
          </button>`,
      )}
    </div>
  `;
}
