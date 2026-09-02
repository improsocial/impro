import { html } from "/js/lib/lit-html.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import "/js/components/app-icon.js";

export function accountSwitcherListTemplate({
  accounts,
  profilesByDid,
  currentDid,
  pendingDid,
  profilesLoading,
  onSelect,
  onAdd,
  addLabel,
  addPending = false,
}) {
  const anyPending = pendingDid !== null || addPending;
  return html`
    <div class="account-switcher-list" data-testid="account-switcher-list">
      ${accounts.map((account) => {
        const profile = profilesByDid[account.did] ?? null;
        return rowTemplate({
          account,
          profile,
          isCurrent: account.did === currentDid,
          isPending: pendingDid === account.did,
          anyPending,
          showSkeleton: profile === null && profilesLoading,
          onClick: onSelect,
        });
      })}
      ${addRowTemplate({
        label: addLabel,
        onClick: onAdd,
        pending: addPending,
        anyPending,
      })}
    </div>
  `;
}

function rowTemplate({
  account,
  profile,
  isCurrent,
  isPending,
  anyPending,
  showSkeleton,
  onClick,
}) {
  const teststate = isPending
    ? "pending"
    : isCurrent
      ? "current"
      : account.needsReauth
        ? "reauth"
        : "other";
  return html`
    <button
      type="button"
      class="account-switcher-item ${account.needsReauth
        ? "account-switcher-item-reauth"
        : ""} ${isPending ? "is-pending" : ""}"
      data-testid="account-switcher-item"
      data-did=${account.did}
      data-teststate=${teststate}
      ?disabled=${anyPending}
      @click=${() => onClick(account)}
    >
      ${showSkeleton
        ? identitySkeletonTemplate()
        : identityTemplate({ profile, account })}
      ${isPending
        ? spinnerTemplate()
        : isCurrent
          ? html`<span class="account-switcher-current-check"
              ><app-icon icon="circle-check"></app-icon
            ></span>`
          : html`<span class="account-switcher-chevron"
              ><app-icon icon="chevron-right-line"></app-icon
            ></span>`}
    </button>
  `;
}

function addRowTemplate({ label, onClick, pending, anyPending }) {
  return html`
    <button
      type="button"
      class="account-switcher-item account-switcher-add"
      data-testid="account-switcher-add"
      ?disabled=${anyPending}
      @click=${() => onClick()}
    >
      <span class="account-switcher-avatar account-switcher-add-icon">
        <app-icon icon="user-plus-line"></app-icon>
      </span>
      <span class="account-switcher-names">
        <span class="account-switcher-display-name">${label}</span>
      </span>
      ${pending ? spinnerTemplate() : null}
    </button>
  `;
}

function identityTemplate({ profile, account }) {
  const handle = profile?.handle ?? account.handle;
  return html`
    <span class="account-switcher-avatar">
      ${profile
        ? avatarTemplate({ author: profile, clickAction: "none" })
        : html`<div class="avatar-placeholder"></div>`}
    </span>
    <span class="account-switcher-names">
      <span class="account-switcher-display-name">
        ${profile
          ? getDisplayName(profile)
          : (account.handle ?? account.did)}${profile
          ? verificationBadgeTemplate({ profile })
          : ""}${profile ? automatedAccountBadgeTemplate({ profile }) : ""}
      </span>
      ${handle
        ? html`<span class="account-switcher-handle">@${handle}</span>`
        : null}
      ${account.needsReauth
        ? html`<span
            class="account-switcher-reauth-hint"
            data-testid="account-switcher-reauth-hint"
            >Sign in again</span
          >`
        : null}
    </span>
  `;
}

function identitySkeletonTemplate() {
  return html`
    <span class="account-switcher-avatar">
      <span class="skeleton-avatar skeleton-animate"></span>
    </span>
    <span
      class="account-switcher-names account-switcher-names-skeleton"
      data-testid="account-switcher-skeleton"
    >
      <span class="skeleton-line-short skeleton-animate"></span>
      <span class="skeleton-line-shorter skeleton-animate"></span>
    </span>
  `;
}

function spinnerTemplate() {
  return html`<span class="account-spinner" data-testid="account-spinner"
    ><span class="loading-spinner"></span
  ></span>`;
}
