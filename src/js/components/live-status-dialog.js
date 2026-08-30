import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import {
  cdnImageUrl,
  getDisplayName,
  getDisplayDomain,
} from "/js/dataHelpers.js";
import { linkToProfile } from "/js/navigation.js";
import { classnames } from "/js/utils.js";

class LiveStatusDialog extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.render();
  }

  open() {
    const dialog = this.querySelector(".live-status-dialog");
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    enableDragToDismiss(dialog, {
      onDismiss: () => this._close(),
      scrollContainer: this.querySelector(".live-status-dialog-content"),
      ignoreTouchTarget: (element) => element.closest("button, a") !== null,
    });
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  _close() {
    const dialog = this.querySelector(".live-status-dialog");
    if (!dialog?.open) {
      this.scrollLock?.release();
      this.scrollLock = null;
      this.dispatchEvent(new CustomEvent("close"));
      return Promise.resolve();
    }
    return closeWithAnimation(dialog);
  }

  async _openProfile() {
    await this._close();
    window.router.go(linkToProfile(this.profile));
  }

  render() {
    const profile = this.profile;
    const external = this.liveStatus?.embed?.external;
    if (!profile || !external) return;
    const title = external.title || external.uri;
    const thumb = external.thumb ? cdnImageUrl(external.thumb) : null;
    render(
      html`
        <dialog
          class="bottom-sheet live-status-dialog"
          data-testid="live-status-dialog"
          @click=${(event) => {
            if (event.target === event.currentTarget) this._close();
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this._close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("close"));
          }}
        >
          <div class="live-status-dialog-content">
            <div class="live-status-card" data-testid="live-status-card">
              ${thumb
                ? html`<div
                    class="live-status-thumb"
                    data-testid="live-status-thumb"
                  >
                    <img
                      src="${thumb}"
                      alt=""
                      class=${classnames("live-status-thumb-image", {
                        "live-status-thumb-image--blurred": !!profile.blurLabel,
                      })}
                    />
                    <div class="live-status-thumb-badge">LIVE</div>
                  </div>`
                : null}
              <div class="live-status-info">
                <div class="live-status-title">${title}</div>
                <div class="live-status-domain">
                  ${getDisplayDomain(external.uri)}
                </div>
              </div>
              <a
                class="rounded-button rounded-button-primary live-status-watch-button"
                data-testid="live-status-watch"
                href="${external.uri}"
                target="_blank"
                rel="noopener noreferrer"
                @click=${() => this._close()}
              >
                Watch now
              </a>
              <div class="live-status-divider"></div>
              <div class="live-status-profile-row">
                ${avatarTemplate({
                  author: profile,
                  clickAction: "none",
                  showLiveBadge: false,
                })}
                <div class="live-status-profile-info">
                  <div class="live-status-profile-name">
                    ${getDisplayName(profile)}
                  </div>
                  <div class="live-status-profile-handle">
                    @${profile.handle}
                  </div>
                </div>
                <button
                  class="rounded-button live-status-open-profile-button"
                  data-testid="live-status-open-profile"
                  @click=${() => this._openProfile()}
                >
                  Open profile
                </button>
              </div>
            </div>
            <div class="live-status-footer">Live feature is in beta</div>
          </div>
        </dialog>
      `,
      this,
    );
  }
}

LiveStatusDialog.register();
