import { html } from "/js/lib/lit-html.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";

const pluginModals = new Map();

export function showPluginModal({
  pluginRenderer,
  pluginId,
  modalId,
  title,
  content,
  onDismiss = () => {},
}) {
  let modal = pluginModals.get(`${pluginId}:${modalId}`);
  if (modal?.isOpen) return;
  if (modal?.isDismissing) {
    modal.nextOpen = {
      pluginRenderer,
      pluginId,
      modalId,
      title,
      content,
      onDismiss,
    };
    return;
  }

  if (!modal) {
    const dialog = document.createElement("dialog");
    dialog.classList.add("modal-dialog", "plugin-modal");
    dialog.dataset.pluginId = pluginId;

    const contentEl = document.createElement("div");
    contentEl.classList.add("modal-dialog-content");
    dialog.appendChild(contentEl);

    modal = {
      dialog,
      contentEl,
      isOpen: false,
      isDismissing: false,
      nextOpen: null,
    };
    let userDismissed = false;
    // Teardown runs on every close — including the router closing it on
    // navigation, which bypasses the dismiss() wrapper below. This dialog is
    // created once and reused across opens, so the listener stays attached.
    dialog.addEventListener("close", () => {
      modal.isOpen = false;
      modal.isDismissing = false;
      if (userDismissed) {
        userDismissed = false;
        modal.onDismiss();
      }
      const nextOpen = modal.nextOpen;
      modal.nextOpen = null;
      if (nextOpen) showPluginModal(nextOpen);
    });
    modal.dismiss = () => closeWithAnimation(dialog);

    function dismiss() {
      if (!modal.isOpen) return;
      userDismissed = true;
      modal.isDismissing = true;
      return modal.dismiss();
    }

    dialog.addEventListener("click", (event) => {
      if (event.target.tagName === "DIALOG") dismiss();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss();
    });

    pluginModals.set(`${pluginId}:${modalId}`, modal);
    document.body.appendChild(dialog);
  }

  modal.onDismiss = onDismiss;
  modal.contentEl.replaceChildren();
  if (!pluginRenderer.isEmptyNode(title)) {
    const titleEl = pluginRenderer.createRoot().render(title);
    if (titleEl.nodeType === Node.ELEMENT_NODE) {
      titleEl.classList.add("modal-dialog-title");
    }
    modal.contentEl.appendChild(titleEl);
  }
  if (content?.children?.length) {
    for (const childNode of content.children) {
      modal.contentEl.appendChild(
        pluginRenderer.createRoot().render(childNode),
      );
    }
  } else if (!pluginRenderer.isEmptyNode(content)) {
    modal.contentEl.appendChild(pluginRenderer.createRoot().render(content));
  }
  modal.isOpen = true;
  modal.dialog.showModal();
}

export function hidePluginModal({ pluginId, modalId }) {
  const modal = pluginModals.get(`${pluginId}:${modalId}`);
  if (modal && modal.isOpen) {
    modal.isDismissing = true;
    modal.dismiss();
  }
}

const ACTION_LABELS = {
  mute: "Mute and unmute accounts on your behalf",
  block: "Block and unblock accounts on your behalf",
  feedFeedback:
    'Send feed feedback (e.g. "show fewer/more like this") on your behalf',
};

const RECORD_LABELS = {
  write: "Create, update, and delete its own private records in your account",
};

function permissionsListTemplate({ permissions }) {
  const sections = [];
  const fetchPatterns = permissions.fetch ?? [];
  if (fetchPatterns.length > 0) {
    sections.push(html`
      <div class="permission-prompt-section">
        <div>Send network requests to:</div>
        <ul class="permission-prompt-list">
          ${fetchPatterns.map(
            (pattern) => html`<li><code>${pattern}</code></li>`,
          )}
        </ul>
      </div>
    `);
  }
  const actionScopes = permissions.actions ?? [];
  if (actionScopes.length > 0) {
    sections.push(html`
      <div class="permission-prompt-section">
        <ul class="permission-prompt-list">
          ${actionScopes.map(
            (scope) => html`<li>${ACTION_LABELS[scope] ?? scope}</li>`,
          )}
        </ul>
      </div>
    `);
  }
  const recordScopes = permissions.records ?? [];
  if (recordScopes.length > 0) {
    sections.push(html`
      <div class="permission-prompt-section">
        <ul class="permission-prompt-list">
          ${recordScopes.map(
            (scope) => html`<li>${RECORD_LABELS[scope] ?? scope}</li>`,
          )}
        </ul>
      </div>
    `);
  }
  return sections;
}

export async function showPluginInstallPermissionsModal({
  pluginName,
  permissions,
}) {
  const name = pluginName ?? "This plugin";
  return confirmModal(
    html`<span data-testid="permission-prompt">
      <span>${name} wants permission to:</span>
      ${permissionsListTemplate({ permissions })}
    </span>`,
    {
      title: "Grant permissions?",
      confirmButtonText: "Allow and install",
    },
  );
}

export async function showPluginUpdatePermissionsModal({
  pluginName,
  pluginVersion,
  permissionsDiff,
}) {
  const name = pluginName ?? "This plugin";
  const heading = pluginVersion
    ? `${name} v${pluginVersion} requests new permissions:`
    : `${name} requests new permissions:`;
  return confirmModal(
    html`<span data-testid="permission-update-prompt">
      <span>${heading}</span>
      ${permissionsListTemplate({ permissions: permissionsDiff })}
    </span>`,
    {
      title: "Grant new permissions?",
      confirmButtonText: "Allow and update",
    },
  );
}
