import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

// Resolution value for programmatic closes (hidePluginModal), which should
// skip the plugin's onDismiss.
const PROGRAMMATIC_HIDDEN = Symbol("plugin-modal-hidden");

const pluginModals = new Map();

class PluginModal extends Modal {
  get className() {
    return "bottom-sheet text-modal plugin-modal";
  }

  get attributes() {
    return { "data-plugin-id": this.options.pluginId, autofocus: "" };
  }

  get scrollContainerSelector() {
    return ".plugin-modal-body";
  }

  render({ props }) {
    return props.contentEl;
  }
}

function buildModalTree(pluginRenderer, title, content) {
  const hasTitle = !pluginRenderer.isEmptyNode(title);
  const titleNode = {
    type: "element",
    tag: "div",
    attrs: hasTitle ? { class: "modal-dialog-title" } : {},
    styles: hasTitle ? {} : { display: "none" },
    children: hasTitle ? [title] : [],
  };
  let childNodes = [];
  if (content?.children?.length) {
    childNodes = content.children;
  } else if (!pluginRenderer.isEmptyNode(content)) {
    childNodes = [content];
  }
  return {
    type: "element",
    tag: "div",
    attrs: { class: "modal-dialog-content" },
    children: [
      titleNode,
      {
        type: "element",
        tag: "div",
        attrs: {
          class: "plugin-modal-body plugin-content sheet-scroll-region",
        },
        children: childNodes,
      },
    ],
  };
}

export function showPluginModal(options) {
  const {
    pluginRenderer,
    pluginId,
    modalId,
    title,
    content,
    onDismiss = () => {},
  } = options;
  const key = `${pluginId}:${modalId}`;
  const existing = pluginModals.get(key);
  if (existing) {
    if (existing.modal.closing) {
      existing.nextOpen = options;
    }
    return;
  }

  const root = pluginRenderer.createRoot();
  const contentEl = root.render(buildModalTree(pluginRenderer, title, content));
  const entry = {
    modal: new PluginModal({ pluginId, contentEl }),
    root,
    nextOpen: null,
  };
  pluginModals.set(key, entry);
  entry.modal.open().then((value) => {
    pluginModals.delete(key);
    if (value !== PROGRAMMATIC_HIDDEN) onDismiss();
    if (entry.nextOpen) showPluginModal(entry.nextOpen);
  });
}

export function updatePluginModal({
  pluginRenderer,
  pluginId,
  modalId,
  title,
  content,
}) {
  const entry = pluginModals.get(`${pluginId}:${modalId}`);
  if (!entry || entry.modal.closing) return;
  entry.root.render(buildModalTree(pluginRenderer, title, content));
}

export function hidePluginModal({ pluginId, modalId }) {
  const entry = pluginModals.get(`${pluginId}:${modalId}`);
  if (!entry) return;
  entry.nextOpen = null;
  entry.modal.dismiss(PROGRAMMATIC_HIDDEN);
}

const ACTION_LABELS = {
  mute: "Mute and unmute accounts on your behalf",
  block: "Block and unblock accounts on your behalf",
  feedFeedback:
    'Send feed feedback (e.g. "show fewer/more like this") on your behalf',
};

function permissionsSectionTemplate({ title, items }) {
  return html`
    <div class="permission-prompt-section">
      <div class="permission-prompt-section-title">${title}</div>
      <ul class="permission-prompt-list">
        ${items.map((item) => html`<li>${item}</li>`)}
      </ul>
    </div>
  `;
}

function permissionsListTemplate({ permissions }) {
  const sections = [];
  const fetchPatterns = permissions.fetch ?? [];
  if (fetchPatterns.length > 0) {
    sections.push(
      permissionsSectionTemplate({
        title: "Send network requests to:",
        items: fetchPatterns.map((pattern) => html`<code>${pattern}</code>`),
      }),
    );
  }
  const actionScopes = permissions.actions ?? [];
  if (actionScopes.length > 0) {
    sections.push(
      permissionsSectionTemplate({
        title: "Act on your account:",
        items: actionScopes.map((scope) => ACTION_LABELS[scope] ?? scope),
      }),
    );
  }
  return html`<div class="permission-prompt-sections">${sections}</div>`;
}

export async function showPluginInstallPermissionsModal({
  pluginName,
  permissions,
}) {
  const name = pluginName ?? "This plugin";
  return confirmModal(
    html`<span class="permission-prompt" data-testid="permission-prompt">
      <span class="permission-prompt-intro">${name} wants permission to:</span>
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
    html`<span class="permission-prompt" data-testid="permission-update-prompt">
      <span class="permission-prompt-intro">${heading}</span>
      ${permissionsListTemplate({ permissions: permissionsDiff })}
    </span>`,
    {
      title: "Grant new permissions?",
      confirmButtonText: "Allow and update",
    },
  );
}
