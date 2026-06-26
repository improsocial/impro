import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { enableDragToDismiss } from "/js/utils.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";

class JoinGroupChatDialog extends Component {
  static get observedAttributes() {
    return ["name", "require-approval"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this.state = new ReactiveStore("join-group-chat-dialog");
    this.state.$isOpen = new Signal.State(false);
    this.state.$isSubmitting = new Signal.State(false);
    this.innerHTML = "";
    this._disposeEffect = effect(() => this.render());
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  attributeChangedCallback() {
    if (this.initialized) this.render();
  }

  render() {
    const isOpen = this.state.$isOpen.get();
    const isSubmitting = this.state.$isSubmitting.get();
    if (!isOpen) {
      render(html``, this);
      return;
    }
    const name = this.getAttribute("name") ?? "";
    const requireApproval = this.hasAttribute("require-approval");
    render(
      html`<dialog
        class="bottom-sheet join-group-chat-dialog"
        data-testid="join-group-chat-dialog"
        @click=${(event) => {
          if (event.target.tagName === "DIALOG") this.close();
        }}
        @cancel=${(event) => {
          event.preventDefault();
          this.close();
        }}
      >
        <div class="join-group-chat-dialog-content">
          <h2
            class="join-group-chat-dialog-title"
            data-testid="join-group-chat-dialog-title"
          >
            ${requireApproval ? "Request to join" : "Join group chat"}
          </h2>
          <p class="join-group-chat-dialog-body">
            ${requireApproval
              ? html`Send a request to join <strong>${name}</strong>. The group
                  owner will review your request before you can see messages.`
              : html`You're about to join <strong>${name}</strong>.`}
          </p>
          <div class="join-group-chat-dialog-actions">
            <button
              class="rounded-button"
              data-testid="join-group-chat-dialog-cancel"
              ?disabled=${isSubmitting}
              @click=${() => this.close()}
            >
              Cancel
            </button>
            <button
              class="rounded-button rounded-button-primary"
              data-testid="join-group-chat-dialog-confirm"
              ?disabled=${isSubmitting}
              @click=${() => this._onConfirm()}
            >
              ${isSubmitting
                ? "Sending…"
                : requireApproval
                  ? "Send request"
                  : "Join"}
            </button>
          </div>
        </div>
      </dialog>`,
      this,
    );
  }

  _onConfirm() {
    if (this.state.$isSubmitting.get()) return;
    this.state.$isSubmitting.set(true);
    this.dispatchEvent(
      new CustomEvent("confirm", {
        detail: {
          successCallback: () => {
            this.state.$isSubmitting.set(false);
            this.close();
          },
          errorCallback: () => {
            this.state.$isSubmitting.set(false);
          },
        },
      }),
    );
  }

  open() {
    this.state.$isOpen.set(true);
    this.state.$isSubmitting.set(false);
    this.render();
    this.scrollLock.lock();
    const dialog = this.querySelector("dialog");
    if (!dialog) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      confirmDismiss: () => !this.state.$isSubmitting.get(),
      allowUpwardStretch: true,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    if (this.state.$isSubmitting.get()) return;
    this.scrollLock.unlock();
    const dialog = this.querySelector("dialog");
    if (dialog?.open) dialog.close();
    this.state.$isOpen.set(false);
    this.dispatchEvent(new CustomEvent("dialog-closed"));
  }
}

JoinGroupChatDialog.register();
