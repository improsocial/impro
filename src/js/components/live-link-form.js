import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { isAllowedLiveHost, getDisplayDomain } from "/js/dataHelpers.js";
import { getLinkCardMeta } from "/js/embedHelpers.js";
import { LIVE_ALLOWED_SERVICES } from "/js/config.js";
import { normalizeUrl } from "/js/utils.js";

const ALLOWED_SERVICES_LABEL =
  "Allowed services: " +
  LIVE_ALLOWED_SERVICES.map(({ displayName }) => displayName).join(", ");

function errorTemplate({ error }) {
  return html`<div
    class="live-dialog-info-box is-error"
    data-testid="link-error"
  >
    ${error}
  </div>`;
}

function infoTemplate() {
  return html`<div class="live-dialog-info-box" data-testid="services-tip">
    ${ALLOWED_SERVICES_LABEL}
  </div>`;
}

function previewTemplate({ linkMeta, linkMetaFailed }) {
  return html`
    <div class="live-link-form-preview" data-testid="link-preview">
      <div class="live-link-form-preview-image">
        ${linkMeta.image
          ? html`<img src="${linkMeta.image}" alt="" loading="lazy" />`
          : html`<div class="live-link-form-preview-image-placeholder">
              No image
            </div>`}
      </div>
      <div class="live-link-form-preview-info">
        <div class="live-link-form-preview-title">${linkMeta.title}</div>
        <div class="live-link-form-preview-domain">
          ${getDisplayDomain(linkMeta.url)}
        </div>
      </div>
    </div>
    ${linkMetaFailed
      ? html`<div
          class="live-dialog-info-box"
          data-testid="link-preview-failed"
        >
          We couldn't load a preview for this link.
        </div>`
      : null}
  `;
}

class LiveLinkForm extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    const initialUrl = this.initialUrl ?? "";
    const initialMeta = this.initialLinkMeta ?? null;
    this._urlInput = initialUrl;
    this._normalizedUrl = initialUrl ? normalizeUrl(initialUrl) : null;
    this._debouncedUrl = this._normalizedUrl;
    this._debounceTimer = null;
    this._linkMeta = initialMeta;
    this._linkMetaLoading = false;
    this._linkMetaFailed = false;
    this._urlError = null;
    this.render();
    if (this._normalizedUrl && !initialMeta) {
      this._loadLinkMeta(this._normalizedUrl);
    }
  }

  disconnectedCallback() {
    clearTimeout(this._debounceTimer);
  }

  focus(options) {
    this.querySelector("input")?.focus(options);
  }

  get isLoading() {
    return this._debouncedUrl !== this._normalizedUrl || this._linkMetaLoading;
  }

  get linkMeta() {
    return this._linkMeta;
  }

  _notifyChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { linkMeta: this._linkMeta, isLoading: this.isLoading },
      }),
    );
  }

  _handleInput(event) {
    const value = event.target.value;
    this._urlInput = value;
    this._urlError = null;
    this._linkMetaFailed = false;
    clearTimeout(this._debounceTimer);
    const normalized = normalizeUrl(value);
    this._normalizedUrl = normalized;
    if (!value.trim()) {
      this._linkMeta = null;
      this._debouncedUrl = null;
      this._linkMetaLoading = false;
      this.render();
      this._notifyChange();
      return;
    }
    this._debounceTimer = setTimeout(() => {
      this._debouncedUrl = normalized;
      this._loadLinkMeta(normalized);
    }, 500);
    this.render();
    this._notifyChange();
  }

  _handleBlur() {
    if (this._urlInput.trim() && !this._normalizedUrl) {
      this._urlError = "This is not a valid link";
      this.render();
      this._notifyChange();
    }
  }

  _handleFocus() {
    if (this._urlError) {
      this._urlError = null;
      this.render();
      this._notifyChange();
    }
  }

  async _loadLinkMeta(url) {
    if (!url) {
      this._linkMeta = null;
      this._linkMetaLoading = false;
      this._linkMetaFailed = false;
      this.render();
      this._notifyChange();
      return;
    }
    if (!isAllowedLiveHost(url)) {
      this._linkMeta = null;
      this._linkMetaLoading = false;
      this._linkMetaFailed = false;
      this._urlError =
        "This service is not supported while the Live feature is in beta.";
      this.render();
      this._notifyChange();
      return;
    }
    this._linkMeta = { url, title: url, description: "", image: null };
    this._linkMetaLoading = true;
    this._linkMetaFailed = false;
    this.render();
    this._notifyChange();
    const data = await getLinkCardMeta(url);
    if (this._debouncedUrl !== url) return;
    if (data) {
      this._linkMeta = {
        url,
        title: data.title || url,
        description: data.description || "",
        image: data.image || null,
      };
    } else {
      this._linkMetaFailed = true;
    }
    this._linkMetaLoading = false;
    this.render();
    this._notifyChange();
  }

  render() {
    render(
      html`
        <label class="live-dialog-field">
          <span class="live-dialog-label">Stream URL</span>
          <input
            type="url"
            data-testid="link-input"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
            placeholder=${this.getAttribute("placeholder") ?? ""}
            .value=${this._urlInput}
            @input=${(event) => this._handleInput(event)}
            @blur=${() => this._handleBlur()}
            @focus=${() => this._handleFocus()}
            @change=${(event) => event.stopPropagation()}
          />
        </label>
        ${this._urlError
          ? errorTemplate({ error: this._urlError })
          : this._linkMeta
            ? previewTemplate({
                linkMeta: this._linkMeta,
                linkMetaFailed: this._linkMetaFailed,
              })
            : infoTemplate()}
      `,
      this,
    );
  }
}

LiveLinkForm.register();
