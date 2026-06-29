import { html, render } from "/js/lib/lit-html.js";
import { getThreadgateAllowSettings } from "/js/dataHelpers.js";
import { linkToProfile, linkToLogin } from "/js/navigation.js";
import { enableDragToDismiss } from "/js/utils.js";

export function showSignInModal() {
  const dialog = document.createElement("dialog");
  dialog.classList.add("modal-dialog", "compact");

  render(
    html`
      <div class="modal-dialog-content">
        <h2
          class="modal-dialog-title modal-dialog-title-large"
          data-testid="modal-title"
        >
          Sign in
        </h2>
        <p class="modal-dialog-message" data-testid="modal-message">
          Sign in to join the conversation!
        </p>
        <a
          href=${linkToLogin()}
          class="modal-dialog-button primary-button full-width"
          data-testid="modal-primary-button"
          @click=${() => {
            dialog.close();
            dialog.remove();
          }}
        >
          Sign in
        </a>
      </div>
    `,
    dialog,
  );

  // Dismiss on backdrop click
  dialog.addEventListener("click", (e) => {
    if (e.target.tagName === "DIALOG") {
      dialog.close();
      dialog.remove();
    }
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

export function showInfoModal({ title, message, confirmButtonText = "OK" }) {
  const dialog = document.createElement("dialog");
  dialog.classList.add("modal-dialog", "info-modal");

  render(
    html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title" data-testid="modal-title">${title}</h2>
        <p class="modal-dialog-message" data-testid="modal-message">
          ${message}
        </p>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button primary-button"
            data-testid="modal-primary-button"
          >
            ${confirmButtonText}
          </button>
        </div>
      </div>
    `,
    dialog,
  );

  const okButton = dialog.querySelector(".primary-button");

  const dismiss = () => {
    dialog.close();
    dialog.remove();
  };

  okButton.addEventListener("click", dismiss);

  // Dismiss on backdrop click
  dialog.addEventListener("click", (e) => {
    if (e.target.tagName === "DIALOG") {
      dismiss();
    }
  });

  // Dismiss on Escape key
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    dismiss();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

export async function confirm(
  message,
  {
    title = null,
    confirmButtonStyle = "primary",
    confirmButtonText = "Confirm",
  } = {},
) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.classList.add("bottom-sheet", "confirm-modal");

    render(
      html`
        <div class="modal-dialog-content">
          ${title
            ? html`<h2 class="modal-dialog-title" data-testid="modal-title">
                ${title}
              </h2>`
            : null}
          <p class="modal-dialog-message" data-testid="modal-message">
            ${message}
          </p>
          <div class="modal-dialog-buttons">
            <button
              class="modal-dialog-button cancel-button"
              data-testid="modal-cancel-button"
            >
              Cancel
            </button>
            <button
              class="modal-dialog-button confirm-button ${confirmButtonStyle}-button"
              data-testid="modal-confirm-button"
            >
              ${confirmButtonText}
            </button>
          </div>
        </div>
      `,
      dialog,
    );

    const cancelButton = dialog.querySelector(".cancel-button");
    const confirmButton = dialog.querySelector(".confirm-button");

    const dismiss = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    cancelButton.addEventListener("click", () => dismiss(false));
    confirmButton.addEventListener("click", () => dismiss(true));

    // Dismiss on backdrop click
    dialog.addEventListener("click", (e) => {
      if (e.target.tagName === "DIALOG") {
        dismiss(false);
      }
    });

    // Dismiss on Escape key
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      dismiss(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => dismiss(false),
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });

    // Allow tests to resolve externally
    globalThis.__testConfirmation?.(resolve);
  });
}

export async function showActionModal({
  title = null,
  message,
  confirmButtonText = "Confirm",
  confirmButtonStyle = "primary",
  onConfirm,
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.classList.add("bottom-sheet", "action-modal");

    let isPending = false;

    const renderContents = () => {
      render(
        html`
          <div class="modal-dialog-content">
            ${title
              ? html`<h2 class="modal-dialog-title" data-testid="modal-title">
                  ${title}
                </h2>`
              : null}
            <p class="modal-dialog-message" data-testid="modal-message">
              ${message}
            </p>
            <div class="modal-dialog-buttons">
              <button
                class="modal-dialog-button cancel-button"
                data-testid="modal-cancel-button"
                ?disabled=${isPending}
                @click=${() => dismiss(false)}
              >
                Cancel
              </button>
              <button
                class="modal-dialog-button confirm-button ${confirmButtonStyle}-button"
                data-testid="modal-confirm-button"
                ?disabled=${isPending}
                @click=${runConfirm}
              >
                ${isPending
                  ? html`<span
                      class="loading-spinner"
                      data-testid="loading-spinner"
                    ></span>`
                  : confirmButtonText}
              </button>
            </div>
          </div>
        `,
        dialog,
      );
    };

    const dismiss = (result) => {
      if (isPending) return;
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    const runConfirm = async () => {
      if (isPending) return;
      isPending = true;
      renderContents();
      try {
        await onConfirm?.();
        dialog.close();
        dialog.remove();
        resolve(true);
      } catch {
        isPending = false;
        renderContents();
      }
    };

    renderContents();

    dialog.addEventListener("click", (event) => {
      if (event.target.tagName === "DIALOG") dismiss(false);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => dismiss(false),
      confirmDismiss: () => !isPending,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  });
}

function ruleTemplate({ rule, author }) {
  if (rule.type === "mention") {
    return html`mentioned users`;
  }
  if (rule.type === "followers") {
    return html`users following
      <a href=${linkToProfile(author)}>@${author.handle}</a>`;
  }
  if (rule.type === "following") {
    return html`users followed by
      <a href=${linkToProfile(author)}>@${author.handle}</a>`;
  }
  if (rule.type === "list") {
    if (rule.list) {
      return html`${rule.list.name} members`;
    }
    return html`list members`;
  }
  return html`unknown`;
}

function threadgateRuleTemplate({ post }) {
  const settings = getThreadgateAllowSettings(post);
  if (!Array.isArray(settings)) {
    if (settings.type === "everybody") {
      return html`Everybody can reply to this post.`;
    }
    if (settings.type === "nobody") {
      return html`Replies to this post are disabled.`;
    }
  }
  if (Array.isArray(settings)) {
    if (settings.some((rule) => rule.type === "unknown")) {
      return html`This post has an unknown type of threadgate on it. Your app
      may be out of date.`;
    }
    const author = post.author;
    const parts = [];
    settings.forEach((rule, i) => {
      if (i > 0) {
        if (i === settings.length - 1) {
          parts.push(html`, and `);
        } else {
          parts.push(html`, `);
        }
      }
      parts.push(ruleTemplate({ rule, author }));
    });
    return html`Only ${parts} can reply.`;
  }
  return null;
}

export async function showExternalLinkWarningModal({ href }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.classList.add("modal-dialog", "external-link-warning-modal");

    const url = new URL(href);

    render(
      html`
        <div class="modal-dialog-content">
          <h2
            class="modal-dialog-title"
            data-testid="external-link-warning-title"
          >
            Leave this app?
          </h2>
          <p
            class="modal-dialog-message"
            data-testid="external-link-warning-message"
          >
            This link will take you to:
          </p>
          <a
            class="external-link-warning-href"
            href=${href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="external-link-warning-href"
            @click=${(event) => {
              event.stopPropagation();
              dismiss(true);
            }}
          >
            <span class="external-link-warning-host">${url.host}</span
            ><span class="external-link-warning-path"
              >${url.pathname}${url.search}${url.hash}</span
            >
          </a>
          <div class="modal-dialog-buttons">
            <button
              class="modal-dialog-button cancel-button"
              data-testid="external-link-warning-cancel-button"
            >
              Cancel
            </button>
            <button
              class="modal-dialog-button confirm-button primary-button"
              data-testid="external-link-warning-visit-button"
            >
              Visit site
            </button>
          </div>
        </div>
      `,
      dialog,
    );

    const cancelButton = dialog.querySelector(".cancel-button");
    const visitButton = dialog.querySelector(".confirm-button");

    const dismiss = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    cancelButton.addEventListener("click", () => dismiss(false));
    visitButton.addEventListener("click", () => {
      window.open(href, "_blank", "noopener,noreferrer");
      dismiss(true);
    });

    dialog.addEventListener("click", (event) => {
      if (event.target.tagName === "DIALOG") dismiss(false);
    });

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export function showWhoCanReplyModal({ post }) {
  const dialog = document.createElement("dialog");
  dialog.classList.add("modal-dialog", "info-modal");
  dialog.dataset.testid = "who-can-reply-modal";

  const dismiss = () => {
    dialog.close();
    dialog.remove();
  };

  const embeddingDisabled = !!post?.viewer?.embeddingDisabled;

  render(
    html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title" data-testid="modal-title">
          Who can interact with this post?
        </h2>
        <div class="modal-dialog-message who-can-reply-body">
          <span>${threadgateRuleTemplate({ post })}</span>
          ${embeddingDisabled
            ? html`<span>No one but the author can quote this post.</span>`
            : ""}
        </div>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button primary-button"
            data-testid="modal-primary-button"
            @click=${dismiss}
          >
            OK
          </button>
        </div>
      </div>
    `,
    dialog,
  );

  dialog.addEventListener("click", (e) => {
    if (e.target.tagName === "DIALOG") {
      dismiss();
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    dismiss();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

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

  if (!modal) {
    const dialog = document.createElement("dialog");
    dialog.classList.add("modal-dialog", "plugin-modal");
    dialog.dataset.pluginId = pluginId;

    const contentEl = document.createElement("div");
    contentEl.classList.add("modal-dialog-content");
    dialog.appendChild(contentEl);

    modal = { dialog, contentEl, isOpen: false };

    function dismiss() {
      if (!modal.isOpen) return;
      modal.isOpen = false;
      dialog.close();
      onDismiss();
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

  modal.contentEl.replaceChildren();
  if (!pluginRenderer.isEmptyNode(title)) {
    const titleEl = pluginRenderer.createRoot().render(title);
    titleEl.classList.add("modal-dialog-title");
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
    modal.isOpen = false;
    modal.dialog.close();
  }
}

export async function showPluginInstallPermissionsModal({
  pluginName,
  permissions,
}) {
  const name = pluginName ?? "This plugin";
  return confirm(
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
  return confirm(
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
  return sections;
}
