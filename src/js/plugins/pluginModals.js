import { renderNode, isEmptyNode } from "./pluginRendering.js";

// key -> { dialog, content, isOpen, dismiss }
const dialogs = new Map();

function dialogKey(pluginId, modalId) {
  return `${pluginId}:${modalId}`;
}

export function setupPluginModals(pluginHost) {
  pluginHost.registerHostCall("openModal", ({ pluginId, args }) => {
    const [options] = args;
    if (!options || options.modalId == null) return;
    const key = dialogKey(pluginId, options.modalId);
    let entry = dialogs.get(key);
    if (entry?.isOpen) return;

    if (!entry) {
      const dialog = document.createElement("dialog");
      dialog.classList.add("modal-dialog", "plugin-modal");
      dialog.dataset.pluginId = pluginId;

      const content = document.createElement("div");
      content.classList.add("modal-dialog-content");
      dialog.appendChild(content);

      entry = { dialog, content, isOpen: false, dismiss: null };

      const dismiss = ({ notify = true } = {}) => {
        if (!entry.isOpen) return;
        entry.isOpen = false;
        dialog.close();
        if (notify)
          pluginHost.sendNotification(pluginId, "modalDismissed", {
            modalId: options.modalId,
          });
      };
      entry.dismiss = dismiss;

      dialog.addEventListener("click", (event) => {
        if (event.target.tagName === "DIALOG") dismiss();
      });
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        dismiss();
      });

      dialogs.set(key, entry);
      document.body.appendChild(dialog);
    }

    entry.content.replaceChildren();
    if (!isEmptyNode(options.title)) {
      const title = renderNode(options.title, pluginId);
      title.classList.add("modal-dialog-title");
      entry.content.appendChild(title);
    }
    if (!isEmptyNode(options.content)) {
      const body = renderNode(options.content, pluginId);
      body.classList.add("modal-dialog-message");
      entry.content.appendChild(body);
    }

    entry.isOpen = true;
    entry.dialog.showModal();
  });

  pluginHost.registerHostCall("closeModal", ({ pluginId, args }) => {
    const [options] = args;
    if (!options || options.modalId == null) return;
    const entry = dialogs.get(dialogKey(pluginId, options.modalId));
    // Plugin-initiated, so don't notify
    if (entry) entry.dismiss({ notify: false });
  });
}
