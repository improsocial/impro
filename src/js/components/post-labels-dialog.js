import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import {
  ADULT_SELF_LABELS,
  OTHER_SELF_LABELS,
  toggleSelfLabelInGroup,
} from "/js/dataHelpers.js";
import "/js/components/app-icon.js";

const LABEL_GROUPS = [
  {
    title: "Adult content",
    testid: "post-labels-adult",
    values: ADULT_SELF_LABELS,
    options: [
      {
        value: "sexual",
        label: "Suggestive",
        description: "Pictures meant for adults.",
      },
      {
        value: "nudity",
        label: "Nudity",
        description: "Artistic or non-erotic nudity.",
      },
      {
        value: "porn",
        label: "Adult",
        description: "Sexual activity or erotic nudity.",
      },
    ],
  },
  {
    title: "Other",
    testid: "post-labels-other",
    values: OTHER_SELF_LABELS,
    options: [
      {
        value: "graphic-media",
        label: "Graphic media",
        description:
          "Media that may be disturbing or inappropriate for some audiences.",
      },
    ],
  },
];

function labelGroupTemplate({ group, labelValues, onToggle }) {
  const selectedOption = group.options.find((option) =>
    labelValues.includes(option.value),
  );
  return html`
    <section class="post-labels-section" data-testid=${group.testid}>
      <h3 class="post-labels-section-title">${group.title}</h3>
      ${group.options.map((option) => {
        const checked = labelValues.includes(option.value);
        return html`
          <label
            class="checkbox-row post-labels-row"
            data-testid="post-labels-option-${option.value}"
            data-teststate=${checked ? "checked" : "unchecked"}
          >
            <input
              type="checkbox"
              .checked=${checked}
              @change=${() => onToggle(group.values, option.value)}
            />
            ${option.label}
          </label>
        `;
      })}
      ${selectedOption
        ? html`<p class="post-labels-description">
            ${selectedOption.description}
          </p>`
        : null}
    </section>
  `;
}

class PostLabelsDialog extends Component {
  static tagName = "post-labels-dialog";

  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("post-labels-dialog");
    this.state.$labelValues = new Signal.State(this.labelValues);
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  _toggle(group, value) {
    const labelValues = toggleSelfLabelInGroup(
      untrack(() => this.state.$labelValues.get()),
      group,
      value,
    );
    this.state.$labelValues.set(labelValues);
    this.dispatchEvent(
      new CustomEvent("labels-change", { detail: { labelValues } }),
    );
  }

  render() {
    const labelValues = this.state.$labelValues.get();
    render(
      html`
        <dialog
          class="bottom-sheet post-labels-dialog ${this.stacked
            ? "bottom-sheet-stacked"
            : ""}"
          data-testid="post-labels-dialog"
          @click=${(event) => {
            if (event.target === event.currentTarget) {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("dialog-closed"));
          }}
        >
          <div class="post-labels-dialog-content">
            <button
              class="dialog-close-button dialog-close-button-floating"
              aria-label="Close"
              @click=${() => this.close()}
            >
              <app-icon icon="close-line"></app-icon>
            </button>
            <div class="post-labels-dialog-body sheet-scroll-region">
              <div class="post-labels-dialog-header">
                <h2 class="post-labels-dialog-title">Add a content warning</h2>
                <p class="post-labels-dialog-subtitle">
                  Please add any content warning labels that are applicable for
                  the media you are posting.
                </p>
              </div>
              ${LABEL_GROUPS.map((group) =>
                labelGroupTemplate({
                  group,
                  labelValues,
                  onToggle: (groupValues, value) =>
                    this._toggle(groupValues, value),
                }),
              )}
              <button
                class="rounded-button rounded-button-primary post-labels-done"
                data-testid="post-labels-done"
                @click=${() => this.close()}
              >
                Done
              </button>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".post-labels-dialog");
    if (dialog.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      scrollContainer: this.querySelector(".post-labels-dialog-body"),
      ignoreTouchTarget: (element) => element.closest("button, label") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector(".post-labels-dialog"));
  }
}

PostLabelsDialog.register();
