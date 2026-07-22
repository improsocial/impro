import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import {
  closeWithAnimation,
  enableDragToDismiss,
  resetScrollOnBlur,
} from "/js/dialogHelpers.js";
import { classnames, graphemeCount, readFileAsDataUrl } from "/js/utils.js";
import { ImageCompressor } from "/js/imageCompressor.js";
import "/js/components/image-cropper.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import { cameraIconTemplate } from "/js/templates/icons/cameraIcon.template.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 300;

class EditListDetailsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._name = "";
    this._description = "";
    this._currentAvatar = null;
    this._newAvatarDataUrl = null;
    this._removeAvatar = false;
    this._saving = false;
    this._error = null;
    this._croppingImageSrc = null;
    this._isOpen = false;
    this._list = null;
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  setList(list) {
    this._list = list;
    this._name = list.name || "";
    this._description = list.description || "";
    this._currentAvatar = list.avatar || null;
    this._newAvatarDataUrl = null;
    this._removeAvatar = false;
    this._saving = false;
    this._error = null;
    this._croppingImageSrc = null;
    this.render();
  }

  get _isDirty() {
    if (!this._list) return false;
    return (
      this._name !== (this._list.name || "") ||
      this._description !== (this._list.description || "") ||
      this._newAvatarDataUrl !== null ||
      this._removeAvatar
    );
  }

  get _isNameTooLong() {
    return graphemeCount(this._name) > MAX_NAME_LENGTH;
  }

  get _isNameEmpty() {
    return this._name.trim().length === 0;
  }

  get _isDescriptionTooLong() {
    return graphemeCount(this._description) > MAX_DESCRIPTION_LENGTH;
  }

  get _canSave() {
    return (
      this._isDirty &&
      !this._saving &&
      !this._isNameEmpty &&
      !this._isNameTooLong &&
      !this._isDescriptionTooLong
    );
  }

  render() {
    const isCropping = !!this._croppingImageSrc;

    const nameCount = graphemeCount(this._name);
    const descriptionCount = graphemeCount(this._description);
    const avatarSrc = this._removeAvatar
      ? null
      : this._newAvatarDataUrl || this._currentAvatar;

    render(
      html`<dialog
        class="bottom-sheet bottom-sheet-fullscreen no-handle edit-profile-dialog edit-list-details-dialog"
        @click=${async (event) => {
          if (!isCropping && event.target.tagName === "DIALOG") {
            if (await this.confirmClose()) {
              this.close();
            }
          }
        }}
        @cancel=${async (event) => {
          event.preventDefault();
          if (isCropping) {
            this._croppingImageSrc = null;
            this.render();
          } else if (await this.confirmClose()) {
            this.close();
          }
        }}
        @close=${() => {
          this.scrollLock?.release();
          this.scrollLock = null;
          this.dispatchEvent(new CustomEvent("edit-list-details-closed"));
        }}
      >
        ${isCropping
          ? html`<div
              class="edit-profile-dialog-content edit-profile-cropper-content sheet-scroll-region"
            >
              <div class="edit-profile-dialog-header">
                <button
                  class="edit-profile-dialog-header-button"
                  data-testid="edit-list-details-crop-cancel-button"
                  @click=${() => {
                    this._croppingImageSrc = null;
                    this.render();
                  }}
                >
                  Cancel
                </button>
                <h2>Edit image</h2>
                <button
                  class="edit-profile-dialog-header-button edit-profile-dialog-save-button"
                  data-testid="edit-list-details-crop-apply-button"
                  @click=${() => this._applyCrop()}
                >
                  Apply
                </button>
              </div>
              <div class="edit-profile-cropper-container">
                <image-cropper
                  src="${this._croppingImageSrc}"
                  aspect-ratio="1"
                  shape="rounded-square"
                ></image-cropper>
              </div>
            </div>`
          : html`<div class="edit-profile-dialog-content sheet-scroll-region">
              <div class="edit-profile-dialog-header">
                <button
                  class="edit-profile-dialog-header-button"
                  data-testid="edit-list-details-cancel-button"
                  @click=${async () => {
                    if (await this.confirmClose()) {
                      this.close();
                    }
                  }}
                  .disabled=${this._saving}
                >
                  Cancel
                </button>
                <h2>Edit list details</h2>
                <button
                  class=${classnames(
                    "edit-profile-dialog-header-button edit-profile-dialog-save-button",
                    { saving: this._saving },
                  )}
                  @click=${() => this._save()}
                  .disabled=${!this._canSave}
                  data-testid="edit-list-details-save-button"
                >
                  <span>Save</span>
                  ${this._saving
                    ? html`<div class="loading-spinner"></div>`
                    : ""}
                </button>
              </div>

              <div class="edit-profile-dialog-body">
                <div
                  class="edit-profile-images-section edit-list-details-images-section"
                >
                  <div
                    class="edit-profile-avatar-wrapper"
                    @click=${() => this._openAvatarMenu()}
                  >
                    <div class="edit-profile-avatar-preview">
                      ${avatarSrc
                        ? html`<img src="${avatarSrc}" alt="Avatar preview" />`
                        : html`<img
                            class="edit-profile-avatar-placeholder"
                            src="/img/list-avatar-fallback.svg"
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

                <context-menu class="edit-list-details-avatar-menu">
                  <context-menu-item-group>
                    <context-menu-item
                      data-testid="menu-action-list-avatar-upload"
                      @click=${() => this._pickImage()}
                    >
                      Upload from Files
                    </context-menu-item>
                  </context-menu-item-group>
                  ${avatarSrc
                    ? html`<context-menu-item-group>
                        <context-menu-item
                          data-testid="menu-action-list-avatar-remove"
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
                  <label for="edit-list-details-name">List Name</label>
                  <input
                    id="edit-list-details-name"
                    type="text"
                    class="edit-profile-input"
                    .value=${this._name}
                    @input=${(event) => {
                      this._name = event.target.value;
                      this.render();
                    }}
                    data-testid="edit-list-details-name"
                  />
                  <div
                    class=${classnames("edit-profile-char-count", {
                      overflow: this._isNameTooLong,
                    })}
                  >
                    ${nameCount}/${MAX_NAME_LENGTH}
                  </div>
                </div>

                <div class="edit-profile-field">
                  <label for="edit-list-details-description">Description</label>
                  <textarea
                    id="edit-list-details-description"
                    class="edit-profile-textarea"
                    .value=${this._description}
                    @input=${(event) => {
                      this._description = event.target.value;
                      this.render();
                    }}
                    rows="4"
                    data-testid="edit-list-details-description"
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
          class="edit-list-details-file-input"
          @change=${(event) => this._handleFileSelect(event)}
          @cancel=${(event) => {
            event.stopPropagation();
          }}
        />
      </dialog>`,
      this,
    );

    if (this._isOpen) {
      const dialog = this.querySelector(".edit-list-details-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    }
  }

  _openAvatarMenu() {
    const menu = this.querySelector(".edit-list-details-avatar-menu");
    const cameraButton = this.querySelector(
      ".edit-profile-camera-button-avatar",
    );
    if (menu && cameraButton) {
      const rect = cameraButton.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom;
      menu.open(x, y);
    }
  }

  _pickImage() {
    const input = this.querySelector(".edit-list-details-file-input");
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

    this._croppingImageSrc = dataUrl;
    this.render();
  }

  async _applyCrop() {
    const cropper = this.querySelector("image-cropper");
    if (!cropper) return;

    const croppedDataUrl = cropper.cropImage();
    if (!croppedDataUrl) return;

    this._newAvatarDataUrl = croppedDataUrl;
    this._removeAvatar = false;
    this._croppingImageSrc = null;
    this.render();
  }

  async _save() {
    this._saving = true;
    this._error = null;
    this.render();

    try {
      let avatarBlob = null;
      if (this._newAvatarDataUrl) {
        const compressed = await new ImageCompressor().compressImage(
          this._newAvatarDataUrl,
        );
        avatarBlob = compressed.blob;
      }

      const successCallback = () => {
        this.close();
      };
      const errorCallback = (error) => {
        console.error("Failed to update list:", error);
        this._error = "Failed to save list. Please try again.";
        this._saving = false;
        this.render();
      };

      this.dispatchEvent(
        new CustomEvent("list-save", {
          detail: {
            listUpdates: {
              name: this._name,
              description: this._description,
              avatarBlob,
              removeAvatar: this._removeAvatar,
            },
            successCallback,
            errorCallback,
          },
        }),
      );
    } catch (error) {
      console.error("Error saving list:", error);
      this._error = "Failed to save list. Please try again.";
      this._saving = false;
      this.render();
    }
  }

  open() {
    this._isOpen = true;
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".edit-list-details-dialog");
    if (dialog?.open) return;
    if (dialog) {
      dialog.showModal();
      enableDragToDismiss(dialog, {
        confirmDismiss: () => this.confirmClose(),
        onClose: () => this.close(),
        scrollContainer: this.querySelector(".edit-profile-dialog-content"),
        ignoreTouchTarget: (el) =>
          !!el.closest("button") ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          !!el.closest("image-cropper"),
        disableWhenKeyboardOpen: true,
      });

      resetScrollOnBlur(
        dialog,
        this.querySelector(".edit-profile-dialog-content"),
      );
    }
  }

  async confirmClose() {
    if (!this._isDirty || !!this._croppingImageSrc || this._saving) return true;
    return confirmModal("Are you sure you want to discard your changes?", {
      title: "Discard changes?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }

  close() {
    this._isOpen = false;
    return closeWithAnimation(this.querySelector(".edit-list-details-dialog"));
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
  }
}

EditListDetailsDialog.register();
