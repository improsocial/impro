import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { classnames, graphemeCount, enableDragToDismiss } from "/js/utils.js";
import { compressImage } from "/js/imageUtils.js";
import "/js/components/image-cropper.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import { cameraIconTemplate } from "/js/templates/icons/cameraIcon.template.js";
import { confirm } from "/js/modals.js";

const MAX_DISPLAY_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 256;

class EditProfileDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
    this._displayName = "";
    this._description = "";
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
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  setProfile(profile) {
    this._profile = profile;
    this._displayName = profile.displayName || "";
    this._description = profile.description || "";
    this._currentAvatar = profile.avatar || null;
    this._currentBanner = profile.banner || null;
    this._newAvatarDataUrl = null;
    this._newBannerDataUrl = null;
    this._removeAvatar = false;
    this._removeBanner = false;
    this._saving = false;
    this._error = null;
    this._croppingTarget = null;
    this._croppingImageSrc = null;
    this.render();
  }

  get _isDirty() {
    if (!this._profile) return false;
    return (
      this._displayName !== (this._profile.displayName || "") ||
      this._description !== (this._profile.description || "") ||
      this._newAvatarDataUrl !== null ||
      this._newBannerDataUrl !== null ||
      this._removeAvatar ||
      this._removeBanner
    );
  }

  get _isDisplayNameTooLong() {
    return graphemeCount(this._displayName) > MAX_DISPLAY_NAME_LENGTH;
  }

  get _isDescriptionTooLong() {
    return graphemeCount(this._description) > MAX_DESCRIPTION_LENGTH;
  }

  get _canSave() {
    return (
      this._isDirty &&
      !this._saving &&
      !this._isDisplayNameTooLong &&
      !this._isDescriptionTooLong
    );
  }

  render() {
    const isCropping = !!this._croppingTarget;

    const displayNameCount = graphemeCount(this._displayName);
    const descriptionCount = graphemeCount(this._description);
    const avatarSrc = this._removeAvatar
      ? null
      : this._newAvatarDataUrl || this._currentAvatar;
    const bannerSrc = this._removeBanner
      ? null
      : this._newBannerDataUrl || this._currentBanner;

    render(
      html`<dialog
        class="bottom-sheet no-handle edit-profile-dialog"
        @click=${(event) => {
          if (!isCropping && event.target.tagName === "DIALOG") {
            this.close();
          }
        }}
        @cancel=${(event) => {
          event.preventDefault();
          if (isCropping) {
            this._croppingTarget = null;
            this._croppingImageSrc = null;
            this.render();
          } else {
            this.close();
          }
        }}
      >
        ${isCropping
          ? html`<div
              class="edit-profile-dialog-content edit-profile-cropper-content"
            >
              <div class="edit-profile-dialog-header">
                <button
                  class="edit-profile-dialog-header-button"
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
                  class="edit-profile-dialog-header-button edit-profile-dialog-save-button"
                  @click=${() => this._applyCrop()}
                >
                  Apply
                </button>
              </div>
              <div class="edit-profile-cropper-container">
                <image-cropper
                  src="${this._croppingImageSrc}"
                  aspect-ratio="${this._croppingTarget === "avatar" ? 1 : 3}"
                  ?circular=${this._croppingTarget === "avatar"}
                ></image-cropper>
              </div>
            </div>`
          : html`<div class="edit-profile-dialog-content">
              <div class="edit-profile-dialog-header">
                <button
                  class="edit-profile-dialog-header-button"
                  @click=${() => this.close()}
                  .disabled=${this._saving}
                >
                  Cancel
                </button>
                <h2>Edit profile</h2>
                <button
                  class="edit-profile-dialog-header-button edit-profile-dialog-save-button"
                  @click=${() => this._save()}
                  .disabled=${!this._canSave}
                  data-testid="edit-profile-save-button"
                >
                  ${this._saving ? "Saving..." : "Save"}
                </button>
              </div>

              <div class="edit-profile-dialog-body">
                <div class="edit-profile-images-section">
                  <div
                    class="edit-profile-banner-preview"
                    @click=${(event) => this._openImageMenu(event, "banner")}
                  >
                    ${bannerSrc
                      ? html`<img src="${bannerSrc}" alt="Banner preview" />`
                      : html`<div
                          class="edit-profile-banner-placeholder"
                        ></div>`}
                    <div class="edit-profile-image-overlay"></div>
                    <div
                      class="edit-profile-camera-button edit-profile-camera-button-banner"
                    >
                      ${cameraIconTemplate()}
                    </div>
                  </div>

                  <div
                    class="edit-profile-avatar-wrapper"
                    @click=${(event) => this._openImageMenu(event, "avatar")}
                  >
                    <div class="edit-profile-avatar-preview">
                      ${avatarSrc
                        ? html`<img src="${avatarSrc}" alt="Avatar preview" />`
                        : html`<img
                            class="edit-profile-avatar-placeholder"
                            src="/img/avatar-fallback.svg"
                            alt=""
                          />`}
                      <div class="edit-profile-image-overlay"></div>
                    </div>
                    <div
                      class="edit-profile-camera-button edit-profile-camera-button-avatar"
                    >
                      ${cameraIconTemplate()}
                    </div>
                  </div>
                </div>

                <context-menu class="edit-profile-banner-menu">
                  <context-menu-item-group>
                    <context-menu-item
                      @click=${() => this._pickImage("banner")}
                    >
                      Upload from Files
                    </context-menu-item>
                  </context-menu-item-group>
                  ${bannerSrc
                    ? html`<context-menu-item-group>
                        <context-menu-item
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
                      @click=${() => this._pickImage("avatar")}
                    >
                      Upload from Files
                    </context-menu-item>
                  </context-menu-item-group>
                  ${avatarSrc
                    ? html`<context-menu-item-group>
                        <context-menu-item
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

                <div class="edit-profile-field">
                  <label for="edit-profile-display-name">Display Name</label>
                  <input
                    id="edit-profile-display-name"
                    type="text"
                    class="edit-profile-input"
                    .value=${this._displayName}
                    @input=${(event) => {
                      this._displayName = event.target.value;
                      this.render();
                    }}
                    data-testid="edit-profile-display-name"
                  />
                  <div
                    class=${classnames("edit-profile-char-count", {
                      overflow: this._isDisplayNameTooLong,
                    })}
                  >
                    ${displayNameCount}/${MAX_DISPLAY_NAME_LENGTH}
                  </div>
                </div>

                <div class="edit-profile-field">
                  <label for="edit-profile-description">Description</label>
                  <textarea
                    id="edit-profile-description"
                    class="edit-profile-textarea"
                    .value=${this._description}
                    @input=${(event) => {
                      this._description = event.target.value;
                      this.render();
                    }}
                    rows="4"
                    data-testid="edit-profile-description"
                  ></textarea>
                  <div
                    class=${classnames("edit-profile-char-count", {
                      overflow: this._isDescriptionTooLong,
                    })}
                  >
                    ${descriptionCount}/${MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>

                ${this._error
                  ? html`<div class="edit-profile-error">${this._error}</div>`
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
      const dialog = this.querySelector(".edit-profile-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    }
  }

  _openImageMenu(event, target) {
    const menuClass =
      target === "avatar"
        ? ".edit-profile-avatar-menu"
        : ".edit-profile-banner-menu";
    const buttonClass =
      target === "avatar"
        ? ".edit-profile-camera-button-avatar"
        : ".edit-profile-camera-button-banner";
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

    const dataUrl = await this._readFileAsDataUrl(file);
    event.target.value = "";

    this._croppingTarget = this._pendingPickTarget;
    this._croppingImageSrc = dataUrl;
    this._pendingPickTarget = null;
    this.render();
  }

  _readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

      if (this._newAvatarDataUrl) {
        const compressed = await compressImage(this._newAvatarDataUrl);
        avatarBlob = compressed.blob;
      }
      if (this._newBannerDataUrl) {
        const compressed = await compressImage(this._newBannerDataUrl);
        bannerBlob = compressed.blob;
      }

      this.dispatchEvent(
        new CustomEvent("profile-save", {
          detail: {
            profileUpdates: {
              displayName: this._displayName,
              description: this._description,
              avatarBlob,
              bannerBlob,
              removeAvatar: this._removeAvatar,
              removeBanner: this._removeBanner,
            },
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
    this.scrollLock.lock();
    const dialog = this.querySelector(".edit-profile-dialog");
    if (dialog) {
      dialog.showModal();

      enableDragToDismiss(dialog, {
        onClose: () => this.close(),
        ignoreTouchTarget: (el) =>
          el.tagName === "BUTTON" ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA",
      });
    }
  }

  async close() {
    if (this._isDirty) {
      const discard = await confirm(
        "Are you sure you want to discard your changes?",
        {
          title: "Discard changes?",
          confirmButtonStyle: "danger",
          confirmButtonText: "Discard",
        },
      );
      if (!discard) return;
    }
    this._isOpen = false;
    this.scrollLock.unlock();
    const dialog = this.querySelector(".edit-profile-dialog");
    if (dialog) {
      dialog.close();
    }
    this.dispatchEvent(new CustomEvent("edit-profile-closed"));
  }

  setError(error) {
    this._error = error;
    this._saving = false;
    this.render();
  }
}

EditProfileDialog.register();
