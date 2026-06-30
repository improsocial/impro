import { html } from "/js/lib/lit-html.js";
import { getThreadgateAllowSettings } from "/js/dataHelpers.js";
import { linkToProfile } from "/js/navigation.js";
import { Modal } from "/js/modals/modal.js";
import { usersIconTemplate } from "/js/templates/icons/usersIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";

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

export class WhoCanReplyModal extends Modal {
  get className() {
    return "bottom-sheet text-modal";
  }

  get attributes() {
    return { "data-testid": "who-can-reply-modal" };
  }

  render({ dismiss, props: { post } }) {
    const embeddingDisabled = !!post?.viewer?.embeddingDisabled;
    return html`
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
            @click=${() => dismiss()}
          >
            OK
          </button>
        </div>
      </div>
    `;
  }
}

export function whoCanReplyBadgeTemplate({ post }) {
  const settings = getThreadgateAllowSettings(post);
  const isEverybody = !Array.isArray(settings) && settings.type === "everybody";
  let label;
  let icon;
  if (isEverybody) {
    label = "Everybody can reply";
    icon = globeIconTemplate();
  } else if (!Array.isArray(settings) && settings.type === "nobody") {
    label = "Replies disabled";
    icon = usersIconTemplate();
  } else {
    label = "Some people can reply";
    icon = usersIconTemplate();
  }
  return html`
    <button
      type="button"
      class="who-can-reply-badge"
      data-testid="who-can-reply-badge"
      @click=${(event) => {
        event.stopPropagation();
        WhoCanReplyModal.open({ post });
      }}
    >
      ${icon} ${label}
    </button>
  `;
}
