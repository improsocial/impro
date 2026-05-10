import { html, render } from "/js/lib/lit-html.js";
import { getThreadgateAllowSettings } from "/js/dataHelpers.js";
import { linkToProfile, linkToLogin } from "/js/navigation.js";

export function showSignInModal() {
  const dialog = document.createElement("dialog");
  dialog.classList.add("modal-dialog", "compact");

  render(
    html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title modal-dialog-title-large">Sign in</h2>
        <p class="modal-dialog-message">Sign in to join the conversation!</p>
        <a
          href=${linkToLogin()}
          class="modal-dialog-button primary-button full-width"
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
        <h2 class="modal-dialog-title">${title}</h2>
        <p class="modal-dialog-message">${message}</p>
        <div class="modal-dialog-buttons">
          <button class="modal-dialog-button primary-button">
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
    dialog.classList.add("modal-dialog");

    render(
      html`
        <div class="modal-dialog-content">
          ${title ? html`<h2 class="modal-dialog-title">${title}</h2>` : null}
          <p class="modal-dialog-message">${message}</p>
          <div class="modal-dialog-buttons">
            <button class="modal-dialog-button cancel-button">Cancel</button>
            <button
              class="modal-dialog-button confirm-button ${confirmButtonStyle}-button"
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
        <h2 class="modal-dialog-title">Who can interact with this post?</h2>
        <div class="modal-dialog-message who-can-reply-body">
          <span>${threadgateRuleTemplate({ post })}</span>
          ${embeddingDisabled
            ? html`<span>No one but the author can quote this post.</span>`
            : ""}
        </div>
        <div class="modal-dialog-buttons">
          <button class="modal-dialog-button primary-button" @click=${dismiss}>
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
    const titleEl = pluginRenderer.renderNode(title, pluginId);
    titleEl.classList.add("modal-dialog-title");
    modal.contentEl.appendChild(titleEl);
  }
  if (content?.children?.length) {
    for (const childNode of content.children) {
      modal.contentEl.appendChild(
        pluginRenderer.renderNode(childNode, pluginId),
      );
    }
  } else if (!pluginRenderer.isEmptyNode(content)) {
    modal.contentEl.appendChild(pluginRenderer.renderNode(content, pluginId));
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
