import { render } from "/js/lib/lit-html.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, enableDragToDismiss } from "/js/dialogHelpers.js";

export class Modal {
  static async open(...args) {
    const instance = new this(...args);
    return instance._mount();
  }

  constructor(options = {}) {
    this.options = options;
  }

  get className() {
    return "bottom-sheet text-modal";
  }

  get attributes() {
    return {};
  }

  get dragToDismiss() {
    return true;
  }

  canDismiss() {
    return true;
  }

  ignoreTouchTarget(element) {
    return element.closest("button") !== null;
  }

  get scrollContainerSelector() {
    return null;
  }

  render() {
    throw new Error(`${this.constructor.name} must implement render()`);
  }

  _mount() {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = this.className;
      for (const [key, value] of Object.entries(this.attributes)) {
        dialog.setAttribute(key, value);
      }

      let scrollLock = null;
      let resolved = false;
      let dismissValue;
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        scrollLock?.release();
        dialog.remove();
        resolve(dismissValue);
      };
      const dismiss = (value) => {
        if (resolved) return;
        resolved = true;
        dismissValue = value;
        return closeWithAnimation(dialog);
      };
      const dismissIfAllowed = () => {
        if (this.canDismiss()) dismiss();
      };
      const update = () => {
        render(this.render({ dismiss, update, props: this.options }), dialog);
      };

      update();

      dialog.addEventListener("click", (event) => {
        if (event.target.tagName === "DIALOG") dismissIfAllowed();
      });
      document.body.appendChild(dialog);
      scrollLock = scrollLocks.acquire({ target: dialog });
      dialog.showModal();
      dialog.addEventListener("close", cleanup);
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        dismissIfAllowed();
      });

      if (this.dragToDismiss) {
        const selector = this.scrollContainerSelector;
        enableDragToDismiss(dialog, {
          onClose: () => dismiss(),
          confirmDismiss: () => this.canDismiss(),
          ignoreTouchTarget: (element) => this.ignoreTouchTarget(element),
          scrollContainer: selector ? dialog.querySelector(selector) : null,
          disableWhenKeyboardOpen: true,
        });
      }
    });
  }
}
