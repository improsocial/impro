import { html, render, repeat } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import {
  avatarThumbnailUrl,
  cdnImageUrl,
  formatProfileLinkUrl,
  getProfileLinkLabel,
  isLabelerProfile,
  isSameProfileLinkList,
  MAX_PROFILE_LINK_TITLE_LENGTH,
  MAX_PROFILE_LINKS,
  validateProfileLinkInput,
} from "/js/dataHelpers.js";
import { getLinkCardMeta } from "/js/embedHelpers.js";
import {
  classnames,
  enableReorder,
  graphemeCount,
  readFileAsDataUrl,
} from "/js/utils.js";
import { profileLinkIconTemplate } from "/js/templates/profileLinkIcon.template.js";
import { ImageCompressor } from "/js/imageCompressor.js";
import "/js/components/app-icon.js";
import "/js/components/image-cropper.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

const MAX_DISPLAY_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 256;
const MAX_PRONOUNS_LENGTH = 20;
const LINK_TITLE_SUGGESTION_DEBOUNCE_MS = 500;

const LINK_ERROR_MESSAGES = {
  invalid: "That doesn’t look like a link. Try something like yoursite.com.",
  insecure:
    "Only secure links can be added. Use a link that starts with https://.",
  shortener: "Short links can’t be added. Use the full link instead.",
  duplicate: "You’ve already added this link.",
};

function suggestLinkTitle(pageTitle) {
  const first = pageTitle.split(/\s+[|\-\u2013\u2014\u00b7]\s+|:\s+/)[0];
  const trimmed = first.trim();
  if (trimmed.length <= MAX_PROFILE_LINK_TITLE_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_PROFILE_LINK_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function profileLinksFieldTemplate({
  links,
  linksFailed,
  disabled,
  onEditLink,
  onAddLink,
}) {
  let content;
  if (links) {
    content = html`${links.length > 0
      ? html`<ul class="edit-profile-links-list">
          ${repeat(
            links,
            (link) => link.url,
            (link, index) =>
              html`<li
                class="edit-profile-link-item"
                data-link-url=${link.url}
                data-testid="edit-profile-link"
              >
                <button
                  class="edit-profile-link-edit-button"
                  data-testid="edit-profile-link-edit-button"
                  .disabled=${disabled}
                  @click=${() => onEditLink(index)}
                >
                  ${profileLinkIconTemplate({ iconUrl: link.iconUrl })}
                  <span class="edit-profile-link-text">
                    <span class="edit-profile-link-label"
                      >${getProfileLinkLabel(link)}</span
                    >
                    <span class="edit-profile-link-url"
                      >${formatProfileLinkUrl(link.url)}</span
                    >
                  </span>
                </button>
                <button
                  class="edit-profile-link-drag-handle"
                  data-testid="edit-profile-link-drag-handle"
                  aria-label="Drag to reorder"
                  .disabled=${disabled}
                >
                  <app-icon icon="hamburger-menu"></app-icon>
                </button>
              </li>`,
          )}
        </ul>`
      : ""}
    ${links.length < MAX_PROFILE_LINKS
      ? html`<button
          class="edit-profile-add-link-button"
          data-testid="edit-profile-add-link-button"
          .disabled=${disabled}
          @click=${() => onAddLink()}
        >
          <app-icon icon="plus-line"></app-icon>
          Add link
        </button>`
      : ""}`;
  } else if (linksFailed) {
    content = html`<div
      class="field-caption"
      data-testid="edit-profile-links-error"
    >
      Couldn’t load your links. Close and reopen to try again.
    </div>`;
  } else {
    content = html`<div class="edit-profile-links-loading">
      <div class="loading-spinner"></div>
    </div>`;
  }
  return html`<div
    class="form-dialog-field edit-profile-links-field"
    data-testid="edit-profile-links"
  >
    <label>Links</label>
    ${content}
  </div>`;
}

function linkFormTemplate({
  linkForm,
  canApply,
  onCancel,
  onApply,
  onRemove,
  onUrlInput,
  onTitleInput,
}) {
  const isEditing = linkForm.index !== null;
  const titleCount = graphemeCount(linkForm.titleInput.trim());
  const onEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onApply();
    }
  };
  return html`<div
    class="form-dialog-content sheet-scroll-region"
    data-testid="edit-profile-link-form"
  >
    <div class="form-dialog-header">
      <button
        class="form-dialog-header-button"
        data-testid="edit-profile-link-cancel-button"
        @click=${() => onCancel()}
      >
        Cancel
      </button>
      <h2>${isEditing ? "Edit link" : "Add link"}</h2>
      <button
        class="form-dialog-header-button form-dialog-save-button"
        data-testid="edit-profile-link-done-button"
        .disabled=${!canApply}
        @click=${() => onApply()}
      >
        Done
      </button>
    </div>
    <div class="form-dialog-body">
      <div class="form-dialog-field">
        <label for="edit-profile-link-url">Link</label>
        <input
          id="edit-profile-link-url"
          type="url"
          class="form-dialog-input"
          placeholder="yoursite.com"
          autocapitalize="none"
          autocomplete="url"
          spellcheck="false"
          .value=${linkForm.urlInput}
          @input=${(event) => onUrlInput(event.target.value)}
          @keydown=${onEnter}
          data-testid="edit-profile-link-url"
        />
        ${linkForm.error
          ? html`<div
              class="edit-profile-link-error"
              data-testid="edit-profile-link-error"
              data-teststate=${linkForm.error}
            >
              ${LINK_ERROR_MESSAGES[linkForm.error]}
            </div>`
          : ""}
      </div>
      <div class="form-dialog-field">
        <label for="edit-profile-link-title">Title (optional)</label>
        <input
          id="edit-profile-link-title"
          type="text"
          class="form-dialog-input"
          placeholder="e.g. Portfolio"
          .value=${linkForm.titleInput}
          @input=${(event) => onTitleInput(event.target.value)}
          @keydown=${onEnter}
          data-testid="edit-profile-link-title"
        />
        <div
          class=${classnames("form-dialog-char-count", {
            overflow: titleCount > MAX_PROFILE_LINK_TITLE_LENGTH,
          })}
        >
          ${titleCount}/${MAX_PROFILE_LINK_TITLE_LENGTH}
        </div>
      </div>
      ${isEditing
        ? html`<button
            class="rounded-button danger-button edit-profile-link-remove-button"
            data-testid="edit-profile-link-remove-button"
            @click=${() => onRemove()}
          >
            Remove link
          </button>`
        : ""}
    </div>
  </div>`;
}

class EditProfileDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._displayName = "";
    this._description = "";
    this._pronouns = "";
    this._currentAvatar = null;
    this._currentBanner = null;
    this._newAvatarDataUrl = null;
    this._newBannerDataUrl = null;
    this._removeAvatar = false;
    this._removeBanner = false;
    this._saving = false;
    this._error = null;
    this._croppingTarget = null; // "avatar" or "banner"
    this._croppingImageSrc = null;
    this._isOpen = false;
    this._profile = null;
    this._linksEnabled = false;
    this._storedLinks = null;
    this._links = null;
    this._linksFailed = false;
    this._linkForm = null;
    this._linkTitleTimer = null;
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  setProfile(profile) {
    this._profile = profile;
    this._displayName = profile.displayName || "";
    this._description = profile.description || "";
    this._pronouns = profile.pronouns || "";
    this._currentAvatar = profile.avatar
      ? cdnImageUrl(avatarThumbnailUrl(profile.avatar))
      : null;
    this._currentBanner = cdnImageUrl(profile.banner) || null;
    this._newAvatarDataUrl = null;
    this._newBannerDataUrl = null;
    this._removeAvatar = false;
    this._removeBanner = false;
    this._saving = false;
    this._error = null;
    this._croppingTarget = null;
    this._croppingImageSrc = null;
    this._storedLinks = null;
    this._links = null;
    this._linksFailed = false;
    this._closeLinkForm();
    this.render();
  }

  enableProfileLinks() {
    this._linksEnabled = true;
    this.render();
  }

  setProfileLinks(links) {
    this._storedLinks = links;
    this._links = links;
    this._linksFailed = false;
    this.render();
  }

  setProfileLinksFailed() {
    this._linksFailed = true;
    this.render();
  }

  get _areLinksDirty() {
    return (
      this._storedLinks !== null &&
      !isSameProfileLinkList(this._links, this._storedLinks)
    );
  }

  get _isDirty() {
    if (!this._profile) return false;
    return (
      this._displayName !== (this._profile.displayName || "") ||
      this._description !== (this._profile.description || "") ||
      this._pronouns !== (this._profile.pronouns || "") ||
      this._newAvatarDataUrl !== null ||
      this._newBannerDataUrl !== null ||
      this._removeAvatar ||
      this._removeBanner ||
      this._areLinksDirty
    );
  }

  get _isDisplayNameTooLong() {
    return graphemeCount(this._displayName) > MAX_DISPLAY_NAME_LENGTH;
  }

  get _isDescriptionTooLong() {
    return graphemeCount(this._description) > MAX_DESCRIPTION_LENGTH;
  }

  get _isPronounsTooLong() {
    return graphemeCount(this._pronouns.trim()) > MAX_PRONOUNS_LENGTH;
  }

  get _canSave() {
    return (
      this._isDirty &&
      !this._saving &&
      !this._isDisplayNameTooLong &&
      !this._isDescriptionTooLong &&
      !this._isPronounsTooLong
    );
  }

  get _canApplyLinkForm() {
    const { urlInput, titleInput } = this._linkForm;
    return (
      urlInput.trim().length > 0 &&
      graphemeCount(titleInput.trim()) <= MAX_PROFILE_LINK_TITLE_LENGTH
    );
  }

  render() {
    const isCropping = !!this._croppingTarget;
    const isEditingLink = !!this._linkForm;
    const isLabeler = !!this._profile && isLabelerProfile(this._profile);

    const displayNameCount = graphemeCount(this._displayName);
    const descriptionCount = graphemeCount(this._description);
    const pronounsCount = graphemeCount(this._pronouns.trim());
    const avatarSrc = this._removeAvatar
      ? null
      : this._newAvatarDataUrl || this._currentAvatar;
    const bannerSrc = this._removeBanner
      ? null
      : this._newBannerDataUrl || this._currentBanner;

    render(
      html`<dialog
        class="bottom-sheet bottom-sheet-fullscreen no-handle form-dialog"
        @click=${async (event) => {
          if (
            !isCropping &&
            !isEditingLink &&
            event.target === event.currentTarget
          ) {
            if (await this.confirmClose()) {
              this.close();
            }
          }
        }}
        @cancel=${async (event) => {
          event.preventDefault();
          if (isCropping) {
            this._croppingTarget = null;
            this._croppingImageSrc = null;
            this.render();
          } else if (isEditingLink) {
            this._closeLinkForm();
            this.render();
          } else if (await this.confirmClose()) {
            this.close();
          }
        }}
        @close=${() => {
          this.scrollLock?.release();
          this.scrollLock = null;
          this.dispatchEvent(new CustomEvent("edit-profile-closed"));
        }}
      >
        ${isCropping
          ? html`<div
              class="form-dialog-content form-dialog-cropper-content sheet-scroll-region"
            >
              <div class="form-dialog-header">
                <button
                  class="form-dialog-header-button"
                  data-testid="edit-profile-crop-cancel-button"
                  @click=${() => {
                    this._croppingTarget = null;
                    this._croppingImageSrc = null;
                    this.render();
                  }}
                >
                  Cancel
                </button>
                <h2>Edit image</h2>
                <button
                  class="form-dialog-header-button form-dialog-save-button"
                  @click=${() => this._applyCrop()}
                >
                  Apply
                </button>
              </div>
              <div class="form-dialog-cropper-container">
                <image-cropper
                  src="${this._croppingImageSrc}"
                  aspect-ratio="${this._croppingTarget === "avatar" ? 1 : 3}"
                  shape="${this._croppingTarget !== "avatar"
                    ? "square"
                    : isLabeler
                      ? "rounded-square"
                      : "circle"}"
                ></image-cropper>
              </div>
            </div>`
          : isEditingLink
            ? linkFormTemplate({
                linkForm: this._linkForm,
                canApply: this._canApplyLinkForm,
                onCancel: () => {
                  this._closeLinkForm();
                  this.render();
                },
                onApply: () => this._applyLinkForm(),
                onRemove: () => this._removeEditingLink(),
                onUrlInput: (value) => this._handleLinkUrlInput(value),
                onTitleInput: (value) => {
                  this._linkForm.titleInput = value;
                  this.render();
                },
              })
            : html`<div class="form-dialog-content sheet-scroll-region">
                <div class="form-dialog-header">
                  <button
                    class="form-dialog-header-button"
                    data-testid="edit-profile-cancel-button"
                    @click=${async () => {
                      if (await this.confirmClose()) {
                        this.close();
                      }
                    }}
                    .disabled=${this._saving}
                  >
                    Cancel
                  </button>
                  <h2>Edit profile</h2>
                  <button
                    class=${classnames(
                      "form-dialog-header-button form-dialog-save-button",
                      { saving: this._saving },
                    )}
                    @click=${() => this._save()}
                    .disabled=${!this._canSave}
                    data-testid="edit-profile-save-button"
                  >
                    <span>Save</span>
                    ${this._saving
                      ? html`<div class="loading-spinner"></div>`
                      : ""}
                  </button>
                </div>

                <div class="form-dialog-body">
                  <div class="form-dialog-images-section">
                    <div
                      class="edit-profile-banner-preview"
                      @click=${(event) => this._openImageMenu(event, "banner")}
                    >
                      ${bannerSrc
                        ? html`<img src="${bannerSrc}" alt="Banner preview" />`
                        : html`<div
                            class="edit-profile-banner-placeholder"
                          ></div>`}
                      <div class="form-dialog-image-overlay"></div>
                      <div
                        class="form-dialog-camera-button form-dialog-camera-button-banner"
                      >
                        <app-icon icon="camera"></app-icon>
                      </div>
                    </div>

                    <div
                      class="form-dialog-avatar-wrapper"
                      @click=${(event) => this._openImageMenu(event, "avatar")}
                    >
                      <div
                        class=${classnames("form-dialog-avatar-preview", {
                          "labeler-avatar": isLabeler,
                        })}
                      >
                        ${avatarSrc
                          ? html`<img
                              src="${avatarSrc}"
                              alt="Avatar preview"
                            />`
                          : html`<img
                              class="form-dialog-avatar-placeholder"
                              src=${isLabeler
                                ? "/img/labeler-avatar-fallback.svg"
                                : "/img/avatar-fallback.svg"}
                              alt=""
                            />`}
                        <div class="form-dialog-image-overlay"></div>
                      </div>
                      <div
                        class="form-dialog-camera-button form-dialog-camera-button-avatar"
                      >
                        <app-icon icon="camera"></app-icon>
                      </div>
                    </div>
                  </div>

                  <context-menu class="edit-profile-banner-menu">
                    <context-menu-item-group>
                      <context-menu-item
                        data-testid="menu-action-banner-upload"
                        icon="image-line"
                        @click=${() => this._pickImage("banner")}
                      >
                        Upload from Files
                      </context-menu-item>
                    </context-menu-item-group>
                    ${bannerSrc
                      ? html`<context-menu-item-group>
                          <context-menu-item
                            data-testid="menu-action-banner-remove"
                            icon="delete-bin-line"
                            @click=${() => {
                              this._newBannerDataUrl = null;
                              this._removeBanner = true;
                              this.render();
                            }}
                          >
                            Remove Banner
                          </context-menu-item>
                        </context-menu-item-group>`
                      : ""}
                  </context-menu>

                  <context-menu class="edit-profile-avatar-menu">
                    <context-menu-item-group>
                      <context-menu-item
                        data-testid="menu-action-avatar-upload"
                        icon="image-line"
                        @click=${() => this._pickImage("avatar")}
                      >
                        Upload from Files
                      </context-menu-item>
                    </context-menu-item-group>
                    ${avatarSrc
                      ? html`<context-menu-item-group>
                          <context-menu-item
                            data-testid="menu-action-avatar-remove"
                            icon="delete-bin-line"
                            @click=${() => {
                              this._newAvatarDataUrl = null;
                              this._removeAvatar = true;
                              this.render();
                            }}
                          >
                            Remove Avatar
                          </context-menu-item>
                        </context-menu-item-group>`
                      : ""}
                  </context-menu>

                  <div class="form-dialog-field">
                    <label for="edit-profile-display-name">Display Name</label>
                    <input
                      id="edit-profile-display-name"
                      type="text"
                      class="form-dialog-input"
                      .value=${this._displayName}
                      @input=${(event) => {
                        this._displayName = event.target.value;
                        this.render();
                      }}
                      data-testid="edit-profile-display-name"
                    />
                    <div
                      class=${classnames("form-dialog-char-count", {
                        overflow: this._isDisplayNameTooLong,
                      })}
                    >
                      ${displayNameCount}/${MAX_DISPLAY_NAME_LENGTH}
                    </div>
                  </div>

                  <div class="form-dialog-field">
                    <label for="edit-profile-pronouns">Pronouns</label>
                    <input
                      id="edit-profile-pronouns"
                      type="text"
                      class="form-dialog-input"
                      placeholder="e.g. she/her"
                      .value=${this._pronouns}
                      @input=${(event) => {
                        this._pronouns = event.target.value;
                        this.render();
                      }}
                      data-testid="edit-profile-pronouns"
                    />
                    <div
                      class=${classnames("form-dialog-char-count", {
                        overflow: this._isPronounsTooLong,
                      })}
                    >
                      ${pronounsCount}/${MAX_PRONOUNS_LENGTH}
                    </div>
                  </div>

                  <div class="form-dialog-field">
                    <label for="edit-profile-description">Description</label>
                    <textarea
                      id="edit-profile-description"
                      class="form-dialog-textarea"
                      .value=${this._description}
                      @input=${(event) => {
                        this._description = event.target.value;
                        this.render();
                      }}
                      rows="4"
                      data-testid="edit-profile-description"
                    ></textarea>
                    <div
                      class=${classnames("form-dialog-char-count", {
                        overflow: this._isDescriptionTooLong,
                      })}
                    >
                      ${descriptionCount}/${MAX_DESCRIPTION_LENGTH}
                    </div>
                  </div>

                  ${this._linksEnabled
                    ? profileLinksFieldTemplate({
                        links: this._links,
                        linksFailed: this._linksFailed,
                        disabled: this._saving,
                        onEditLink: (index) => this._openLinkForm(index),
                        onAddLink: () => this._openLinkForm(null),
                      })
                    : ""}
                  ${this._error
                    ? html`<div
                        class="form-dialog-error"
                        data-testid="form-dialog-error"
                      >
                        ${this._error}
                      </div>`
                    : ""}
                </div>
              </div>`}

        <input
          type="file"
          accept="image/*"
          style="display: none;"
          class="edit-profile-file-input"
          @change=${(event) => this._handleFileSelect(event)}
          @cancel=${(event) => {
            event.stopPropagation();
          }}
        />
      </dialog>`,
      this,
    );

    if (this._isOpen) {
      const dialog = this.querySelector(".form-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    }

    const linksList = this.querySelector(".edit-profile-links-list");
    if (linksList && !this._saving) {
      enableReorder(linksList, {
        itemSelector: ".edit-profile-link-item",
        handleSelector: ".edit-profile-link-drag-handle",
        onReorder: (elements) => {
          const linksByUrl = new Map(
            this._links.map((link) => [link.url, link]),
          );
          this._links = elements.map((element) =>
            linksByUrl.get(element.dataset.linkUrl),
          );
          this.render();
        },
      });
    } else if (linksList?.__reorderEnabled) {
      linksList.__reorderEnabled.cleanup();
    }
  }

  _openLinkForm(index) {
    const link = index === null ? null : this._links[index];
    this._linkForm = {
      index,
      urlInput: link ? formatProfileLinkUrl(link.url) : "",
      titleInput: link?.title ?? "",
      error: null,
      autoTitle: "",
    };
    this.render();
    this.querySelector("#edit-profile-link-url")?.focus({
      preventScroll: true,
    });
  }

  _closeLinkForm() {
    clearTimeout(this._linkTitleTimer);
    this._linkTitleTimer = null;
    this._linkForm = null;
  }

  _otherLinkUrls() {
    return this._links
      .filter((_, i) => i !== this._linkForm.index)
      .map((link) => link.url);
  }

  _linkFormTargetUrl() {
    const { index, urlInput } = this._linkForm;
    const link = index === null ? null : this._links[index];
    if (link && urlInput.trim() === formatProfileLinkUrl(link.url)) {
      return { url: link.url, error: null };
    }
    return validateProfileLinkInput(urlInput, this._otherLinkUrls());
  }

  _handleLinkUrlInput(value) {
    const linkForm = this._linkForm;
    linkForm.urlInput = value;
    const { url, error } = this._linkFormTargetUrl();
    linkForm.error = error === "insecure" ? error : null;
    this.render();

    clearTimeout(this._linkTitleTimer);
    if (!url || error) return;
    this._linkTitleTimer = setTimeout(
      () => this._suggestLinkTitle(linkForm, url),
      LINK_TITLE_SUGGESTION_DEBOUNCE_MS,
    );
  }

  async _suggestLinkTitle(linkForm, url) {
    const meta = await getLinkCardMeta(url, { timeoutMs: 8000 });
    if (this._linkForm !== linkForm || this._linkFormTargetUrl().url !== url) {
      return;
    }
    const suggestion = meta?.title ? suggestLinkTitle(meta.title) : "";
    if (!suggestion) return;
    const currentTitle = linkForm.titleInput.trim();
    if (currentTitle && linkForm.titleInput !== linkForm.autoTitle) return;
    linkForm.autoTitle = suggestion;
    linkForm.titleInput = suggestion;
    this.render();
  }

  _applyLinkForm() {
    if (!this._canApplyLinkForm) return;
    const { index, titleInput } = this._linkForm;
    const { url, error } = this._linkFormTargetUrl();
    if (error) {
      this._linkForm.error = error;
      this.render();
      return;
    }
    const previous = index === null ? null : this._links[index];
    const isSameUrl = previous?.url === url;
    const link = {
      url,
      title: titleInput.trim() || null,
      icon: isSameUrl ? previous.icon : null,
      iconUrl: isSameUrl ? previous.iconUrl : null,
      uri: previous?.uri ?? null,
      cid: previous?.cid ?? null,
    };
    this._links =
      index === null
        ? [...this._links, link]
        : this._links.map((existing, i) => (i === index ? link : existing));
    this._closeLinkForm();
    this.render();
  }

  _removeEditingLink() {
    const { index } = this._linkForm;
    this._links = this._links.filter((_, i) => i !== index);
    this._closeLinkForm();
    this.render();
  }

  _openImageMenu(event, target) {
    const menuClass =
      target === "avatar"
        ? ".edit-profile-avatar-menu"
        : ".edit-profile-banner-menu";
    const buttonClass =
      target === "avatar"
        ? ".form-dialog-camera-button-avatar"
        : ".form-dialog-camera-button-banner";
    const menu = this.querySelector(menuClass);
    const cameraButton = this.querySelector(buttonClass);
    if (menu && cameraButton) {
      const rect = cameraButton.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom;
      menu.open(x, y);
    }
  }

  _pickImage(target) {
    this._pendingPickTarget = target;
    const input = this.querySelector(".edit-profile-file-input");
    if (input) {
      input.click();
    }
  }

  async _handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    event.target.value = "";

    this._croppingTarget = this._pendingPickTarget;
    this._croppingImageSrc = dataUrl;
    this._pendingPickTarget = null;
    this.render();
  }

  async _applyCrop() {
    const cropper = this.querySelector("image-cropper");
    if (!cropper) return;

    const croppedDataUrl = cropper.cropImage();
    if (!croppedDataUrl) return;

    if (this._croppingTarget === "avatar") {
      this._newAvatarDataUrl = croppedDataUrl;
      this._removeAvatar = false;
    } else {
      this._newBannerDataUrl = croppedDataUrl;
      this._removeBanner = false;
    }

    this._croppingTarget = null;
    this._croppingImageSrc = null;
    this.render();
  }

  async _save() {
    this._saving = true;
    this._error = null;
    this.render();

    try {
      let avatarBlob = null;
      let bannerBlob = null;
      const imageCompressor = new ImageCompressor();

      if (this._newAvatarDataUrl) {
        const compressed = await imageCompressor.compressImage(
          this._newAvatarDataUrl,
        );
        avatarBlob = compressed.blob;
      }
      if (this._newBannerDataUrl) {
        const compressed = await imageCompressor.compressImage(
          this._newBannerDataUrl,
        );
        bannerBlob = compressed.blob;
      }

      const successCallback = () => {
        this.close();
      };
      const errorCallback = (error) => {
        console.error("Failed to update profile:", error);
        this._error = "Failed to save profile. Please try again.";
        this._saving = false;
        this.render();
      };

      this.dispatchEvent(
        new CustomEvent("profile-save", {
          detail: {
            profileUpdates: {
              displayName: this._displayName,
              description: this._description,
              pronouns: this._pronouns,
              avatarBlob,
              bannerBlob,
              removeAvatar: this._removeAvatar,
              removeBanner: this._removeBanner,
              ...(this._areLinksDirty && {
                links: this._links,
                previousLinks: this._storedLinks,
              }),
            },
            successCallback,
            errorCallback,
          },
        }),
      );
    } catch (error) {
      console.error("Error saving profile:", error);
      this._error = "Failed to save profile. Please try again.";
      this._saving = false;
      this.render();
    }
  }

  open() {
    this._isOpen = true;
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".form-dialog");
    if (dialog?.open) return;
    if (dialog) {
      dialog.showModal();
      enableDragToDismiss(dialog, {
        confirmDismiss: () => this.confirmClose(),
        onDismiss: () => this.close(),
        scrollContainer: this.querySelector(".form-dialog-content"),
        dragHandle: this.querySelector(".form-dialog-header"),
        ignoreTouchTarget: (el) =>
          !!el.closest("button") ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          !!el.closest("image-cropper"),
        disableWhenKeyboardOpen: true,
      });

      resetScrollOnBlur(dialog, this.querySelector(".form-dialog-content"));
    }
  }

  async confirmClose() {
    if (!this._isDirty || !!this._croppingTarget || this._saving) return true;
    return confirmModal("Are you sure you want to discard your changes?", {
      title: "Discard changes?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }

  close() {
    this._isOpen = false;
    return closeWithAnimation(this.querySelector(".form-dialog"));
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
    clearTimeout(this._linkTitleTimer);
  }
}

EditProfileDialog.register();
