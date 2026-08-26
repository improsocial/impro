import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import "/js/components/emoji-picker-dialog.js";

const QUICK_EMOJIS = ["❤️", "👍", "😆", "👀", "😢"];
const EMOJI_REACTION_LIMIT = 5;

class ReactionPalette extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
    document.addEventListener("click", this._onDocumentClick);
    document.addEventListener("keydown", this._onDocumentKeyDown);
    const firstButton = this.querySelector(
      ".reaction-palette-button:not([disabled])",
    );
    firstButton?.focus({ preventScroll: true });
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocumentClick);
    document.removeEventListener("keydown", this._onDocumentKeyDown);
  }

  set ownReactions(value) {
    this._ownReactions = value ?? [];
    if (this._initialized) this._render();
  }
  get ownReactions() {
    return this._ownReactions ?? [];
  }

  _onDocumentClick = (event) => {
    if (this.contains(event.target)) return;
    this.dispatchEvent(
      new CustomEvent("close", { detail: { reason: "outside" } }),
    );
  };

  _onDocumentKeyDown = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("close", { detail: { reason: "escape" } }),
    );
  };

  _emitSelect(emoji) {
    this.dispatchEvent(new CustomEvent("select", { detail: { emoji } }));
  }

  _emitRemove(emoji) {
    this.dispatchEvent(
      new CustomEvent("remove-reaction", { detail: { emoji } }),
    );
  }

  _render() {
    const own = new Set(this.ownReactions);
    const limitReached = own.size >= EMOJI_REACTION_LIMIT;
    render(
      html`
        <div
          class="reaction-palette"
          data-testid="reaction-palette"
          @click=${(event) => event.stopPropagation()}
        >
          ${QUICK_EMOJIS.map((emoji) => {
            const isActive = own.has(emoji);
            const isDisabled = limitReached && !isActive;
            return html`
              <button
                class="reaction-palette-button ${isActive
                  ? "reaction-palette-button-active"
                  : ""}"
                data-testid="reaction-palette-button"
                data-teststate=${isActive
                  ? "active"
                  : isDisabled
                    ? "disabled"
                    : "default"}
                ?disabled=${isDisabled}
                aria-pressed=${isActive ? "true" : "false"}
                aria-label=${isActive
                  ? `Remove ${emoji} reaction`
                  : `React with ${emoji}`}
                @click=${(event) => {
                  event.stopPropagation();
                  if (isActive) {
                    this._emitRemove(emoji);
                  } else {
                    this._emitSelect(emoji);
                  }
                }}
              >
                <span class="reaction-palette-button-inner">${emoji}</span>
              </button>
            `;
          })}
          <button
            class="reaction-palette-button reaction-palette-button-more"
            data-testid="reaction-palette-more"
            aria-label="Open emoji picker"
            @click=${(event) => {
              const dialog = event.currentTarget.nextElementSibling;
              if (dialog.isOpen) {
                dialog.close();
              } else {
                dialog.open(event.currentTarget);
              }
            }}
          >
            <span class="reaction-palette-button-inner">...</span>
          </button>
          <emoji-picker-dialog
            @select=${(event) => this._emitSelect(event.detail.emoji)}
          ></emoji-picker-dialog>
        </div>
      `,
      this,
    );
  }
}

ReactionPalette.register();
