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
const CURATE_LIST_PURPOSE = "app.bsky.graph.defs#curatelist";
const MOD_LIST_PURPOSE = "app.bsky.graph.defs#modlist";

class CreateListDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._name = "";
    this._description = "";
    this._newAvatarDataUrl = null;
    this._purpose = CURATE_LIST_PURPOSE;
    this._saving = false;
    this._error = null;
    this._croppingImageSrc = null;
    this._isOpen = false;
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  get _isDirty() {
    return (
      this._name.length > 0 ||
      this._description.length > 0 ||
      this._newAvatarDataUrl !== null
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
    const avatarSrc = this._newAvatarDataUrl;

    render(
      html`<dialog
        class="bottom-sheet bottom-sheet-fullscreen no-handle form-dialog create-list-dialog"
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
          this.dispatchEvent(new CustomEvent("create-list-closed"));
        }}
      >
        ${isCropping
          ? html`<div
              class="form-dialog-content form-dialog-cropper-content sheet-scroll-region"
            >
              <div class="form-dialog-header">
                <button
                  class="form-dialog-header-button"
                  data-testid="create-list-crop-cancel-button"
                  @click=${() => {
                    this._croppingImageSrc = null;
                    this.render();
                  }}
                >
                  Cancel
                </button>
                <h2>Edit image</h2>
                <button
                  class="form-dialog-header-button form-dialog-save-button"
                  data-testid="create-list-crop-apply-button"
                  @click=${() => this._applyCrop()}
                >
                  Apply
                </button>
              </div>
              <div class="form-dialog-cropper-container">
                <image-cropper
                  src="${this._croppingImageSrc}"
                  aspect-ratio="1"
                  shape="rounded-square"
                ></image-cropper>
              </div>
            </div>`
          : html`<div class="form-dialog-content sheet-scroll-region">
              <div class="form-dialog-header">
                <button
                  class="form-dialog-header-button"
                  data-testid="create-list-cancel-button"
                  @click=${async () => {
                    if (await this.confirmClose()) {
                      this.close();
                    }
                  }}
                  .disabled=${this._saving}
                >
                  Cancel
                </button>
                <h2>New list</h2>
                <button
                  class=${classnames(
                    "form-dialog-header-button form-dialog-save-button",
                    { saving: this._saving },
                  )}
                  @click=${() => this._save()}
                  .disabled=${!this._canSave}
                  data-testid="create-list-save-button"
                >
                  <span>Create</span>
                  ${this._saving
                    ? html`<div class="loading-spinner"></div>`
                    : ""}
                </button>
              </div>

              <div class="form-dialog-body">
                <div class="form-dialog-field">
                  <div class="field-caption">List Avatar</div>
                  <div class="form-dialog-images-section">
                    <div
                      class="form-dialog-avatar-wrapper"
                      @click=${() => this._openAvatarMenu()}
                    >
                      <div class="form-dialog-avatar-preview">
                        ${avatarSrc
                          ? html`<img
                              src="${avatarSrc}"
                              alt="Avatar preview"
                            />`
                          : html`<img
                              class="form-dialog-avatar-placeholder"
                              src="/img/list-avatar-fallback.svg"
                              alt=""
                            />`}
                        <div class="form-dialog-image-overlay"></div>
                      </div>
                      <div
                        class="form-dialog-camera-button form-dialog-camera-button-avatar"
                      >
                        ${cameraIconTemplate()}
                      </div>
                    </div>
                  </div>
                </div>

                <context-menu class="create-list-avatar-menu">
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
                            this.render();
                          }}
                        >
                          Remove Avatar
                        </context-menu-item>
                      </context-menu-item-group>`
                    : ""}
                </context-menu>

                <div class="form-dialog-field">
                  <div class="field-caption">List Type</div>
                  <div
                    class="pill-radio-group"
                    data-testid="create-list-purpose"
                    @change=${(event) => {
                      this._purpose = event.target.value;
                      this.render();
                    }}
                  >
                    <label>
                      <input
                        type="radio"
                        name="create-list-purpose"
                        value=${CURATE_LIST_PURPOSE}
                        ?checked=${this._purpose === CURATE_LIST_PURPOSE}
                      />
                      User list
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="create-list-purpose"
                        value=${MOD_LIST_PURPOSE}
                        ?checked=${this._purpose === MOD_LIST_PURPOSE}
                      />
                      Moderation list
                    </label>
                  </div>
                </div>

                <div class="form-dialog-field">
                  <label class="field-caption" for="create-list-name"
                    >List Name</label
                  >
                  <input
                    id="create-list-name"
                    type="text"
                    placeholder="e.g. My List"
                    class="form-dialog-input"
                    .value=${this._name}
                    @input=${(event) => {
                      this._name = event.target.value;
                      this.render();
                    }}
                    data-testid="create-list-name"
                  />
                  <div
                    class=${classnames("form-dialog-char-count", {
                      overflow: this._isNameTooLong,
                    })}
                  >
                    ${nameCount}/${MAX_NAME_LENGTH}
                  </div>
                </div>

                <div class="form-dialog-field">
                  <label class="field-caption" for="create-list-description"
                    >Description</label
                  >
                  <textarea
                    id="create-list-description"
                    class="form-dialog-textarea"
                    .value=${this._description}
                    @input=${(event) => {
                      this._description = event.target.value;
                      this.render();
                    }}
                    rows="4"
                    data-testid="create-list-description"
                  ></textarea>
                  <div
                    class=${classnames("form-dialog-char-count", {
                      overflow: this._isDescriptionTooLong,
                    })}
                  >
                    ${descriptionCount}/${MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>

                ${this._error
                  ? html`<div class="form-dialog-error">${this._error}</div>`
                  : ""}
              </div>
            </div>`}

        <input
          type="file"
          accept="image/*"
          style="display: none;"
          class="create-list-file-input"
          @change=${(event) => this._handleFileSelect(event)}
          @cancel=${(event) => {
            event.stopPropagation();
          }}
        />
      </dialog>`,
      this,
    );

    if (this._isOpen) {
      const dialog = this.querySelector(".create-list-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    }
  }

  _openAvatarMenu() {
    const menu = this.querySelector(".create-list-avatar-menu");
    const cameraButton = this.querySelector(
      ".form-dialog-camera-button-avatar",
    );
    if (menu && cameraButton) {
      const rect = cameraButton.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom;
      menu.open(x, y);
    }
  }

  _pickImage() {
    const input = this.querySelector(".create-list-file-input");
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
        console.error("Failed to create list:", error);
        this._error = "Failed to create list. Please try again.";
        this._saving = false;
        this.render();
      };

      this.dispatchEvent(
        new CustomEvent("list-create", {
          detail: {
            listData: {
              purpose: this._purpose,
              name: this._name,
              description: this._description,
              avatarBlob,
            },
            successCallback,
            errorCallback,
          },
        }),
      );
    } catch (error) {
      console.error("Error creating list:", error);
      this._error = "Failed to create list. Please try again.";
      this._saving = false;
      this.render();
    }
  }

  open() {
    this._isOpen = true;
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".create-list-dialog");
    if (dialog?.open) return;
    if (dialog) {
      dialog.showModal();
      enableDragToDismiss(dialog, {
        confirmDismiss: () => this.confirmClose(),
        onClose: () => this.close(),
        scrollContainer: this.querySelector(".form-dialog-content"),
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
    if (!this._isDirty || !!this._croppingImageSrc || this._saving) return true;
    return confirmModal("Are you sure you want to discard this list?", {
      title: "Discard list?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }

  close() {
    this._isOpen = false;
    return closeWithAnimation(this.querySelector(".create-list-dialog"));
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
  }
}

CreateListDialog.register();
