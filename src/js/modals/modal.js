import { render } from "/js/lib/lit-html.js";
import { enableDragToDismiss } from "/js/utils.js";

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

      let resolved = false;
      const dismiss = (value) => {
        if (resolved) return;
        resolved = true;
        dialog.close();
        dialog.remove();
        resolve(value);
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
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        dismissIfAllowed();
      });

      document.body.appendChild(dialog);
      dialog.showModal();

      if (this.dragToDismiss) {
        enableDragToDismiss(dialog, {
          onClose: () => dismiss(),
          confirmDismiss: () => this.canDismiss(),
          ignoreTouchTarget: (element) => this.ignoreTouchTarget(element),
        });
      }
    });
  }
}
