import { html, render, keyed } from "/js/lib/lit-html.js";
import { Signal, effect } from "/js/signals.js";
import { classnames, formatLargeNumber } from "/js/utils.js";
import {
  cdnImageUrl,
  getDisplayDomain,
  getDisplayName,
  isLabelerProfile,
  hasValidHandle,
} from "/js/dataHelpers.js";
import {
  linkToProfile,
  linkToProfileFollowers,
  linkToProfileFollowing,
} from "/js/navigation.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { knownFollowersSummaryTemplate } from "/js/templates/knownFollowersSummary.template.js";
import { Component } from "/js/components/component.js";
import "/js/components/floating-card.js";
import "/js/components/detected-rich-text.js";
import "/js/components/app-icon.js";

// A hover card that renders profile data for a given DID inside an inner
// <floating-card>. Set `dataLayer` and `interactionHandlers` once, then drive
// with `card.did = "..."` + `card.open(rect)` / `card.reposition(rect)` /
// `card.close()`.
class ProfileHoverCard extends Component {
  #$did = new Signal.State(null);
  #dataLayer = null;
  #interactionHandlers = null;
  #disposeRender = null;
  #floatingCard = null;

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    this.#floatingCard = document.createElement("floating-card");
    this.#floatingCard.setAttribute("data-testid", "profile-hover-card");
    this.appendChild(this.#floatingCard);

    this.#disposeRender = effect(() => {
      const did = this.#$did.get();
      if (!did || !this.#dataLayer) return;
      const derived = this.#dataLayer.derived;
      const profile =
        derived.$hydratedDetailedProfiles.get(did) ??
        derived.$hydratedProfiles.get(did) ??
        null;
      const currentUser = derived.$currentUser.get();
      const isDetailed = !!derived.$hydratedDetailedProfiles.get(did);
      const liveStatus = derived.$actorLiveStatus.get(did);
      const isLive = liveStatus.state === "active" && !!profile;
      // Match social-app: the live card is wider than the profile card
      this.#floatingCard.style.width = isLive ? "350px" : "300px";
      render(
        keyed(
          did,
          isLive
            ? liveHoverCardTemplate({
                profile,
                liveStatus,
                onOpenProfile: () => {
                  this.close();
                  window.router.go(linkToProfile(profile));
                },
              })
            : hoverCardTemplate({
                profile,
                isDetailed,
                currentUser,
                interactionHandlers: this.#interactionHandlers,
                dataLayer: this.#dataLayer,
              }),
        ),
        this.#floatingCard,
      );
    });
  }

  disconnectedCallback() {
    this.#disposeRender?.();
    this.#disposeRender = null;
  }

  open(anchorRect) {
    this.#floatingCard?.open(anchorRect);
  }
  close() {
    this.#floatingCard?.close();
  }
  reposition(anchorRect) {
    this.#floatingCard?.reposition(anchorRect);
  }
  get isOpen() {
    return !!this.#floatingCard?.isOpen;
  }

  set did(value) {
    this.#$did.set(value ?? null);
  }
  get did() {
    return this.#$did.get();
  }

  set dataLayer(value) {
    this.#dataLayer = value;
  }
  set interactionHandlers(value) {
    this.#interactionHandlers = value;
  }
}

ProfileHoverCard.register();

function liveHoverCardTemplate({ profile, liveStatus, onOpenProfile }) {
  const external = liveStatus?.embed?.external;
  if (!external) return null;
  const title = external.title || external.uri;
  const thumb = external.thumb ? cdnImageUrl(external.thumb) : null;
  return html`<div class="profile-hover-card-anim">
    <div class="live-status-card" data-testid="live-status-card">
      ${thumb
        ? html`<div class="live-status-thumb" data-testid="live-status-thumb">
            <img
              src="${thumb}"
              alt=""
              class=${classnames("live-status-thumb-image", {
                "is-blurred": !!profile.blurLabel,
              })}
            />
            <div class="live-status-thumb-badge">LIVE</div>
          </div>`
        : null}
      <div class="live-status-info">
        <div class="live-status-title">${title}</div>
        <div class="live-status-domain">${getDisplayDomain(external.uri)}</div>
      </div>
      <a
        class="rounded-button rounded-button-primary live-status-watch-button"
        data-testid="live-status-watch"
        href="${external.uri}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch now
      </a>
      <div class="live-status-divider"></div>
      <div class="live-status-profile-row">
        ${avatarTemplate({
          author: profile,
          clickAction: "none",
          showLiveBadge: false,
        })}
        <div class="live-status-profile-info">
          <div class="live-status-profile-name">${getDisplayName(profile)}</div>
          <div class="live-status-profile-handle">@${profile.handle}</div>
        </div>
        <button
          class="rounded-button live-status-open-profile-button"
          data-testid="live-status-open-profile"
          @click=${onOpenProfile}
        >
          Open profile
        </button>
      </div>
    </div>
  </div>`;
}

function loadingBodyTemplate() {
  return html`<div class="profile-hover-card-loading">
    <span class="loading-spinner"></span>
  </div>`;
}

function followButtonTemplate({
  profile,
  isCurrentUser,
  isLabeler,
  isBlocking,
  isBlockedBy,
  isBlockingByList,
  isAuthenticated,
  isFollowPending,
  onFollow,
}) {
  if (isCurrentUser) return null;
  if (isLabeler) return null;
  if (!isAuthenticated) return null;
  const isBlocked = isBlocking || isBlockedBy || isBlockingByList;
  if (isBlocked) {
    return html`<a
      class="rounded-button profile-following-button hover-card-view-profile"
      data-testid="hover-card-view-profile"
      href="${linkToProfile(profile)}"
      >View profile</a
    >`;
  }
  const isFollowing = !!profile.viewer?.following;
  const isFollowedBy = !!profile.viewer?.followedBy;
  const state = isFollowing
    ? "following"
    : isFollowedBy
      ? "follow-back"
      : "follow";
  return html`<button
    class=${classnames("rounded-button profile-following-button", {
      "rounded-button-primary": !isFollowing,
    })}
    data-testid="follow-button"
    data-teststate=${state}
    ?disabled=${isFollowPending}
    @mouseup=${(e) => e.stopPropagation()}
    @click=${(e) => {
      e.stopPropagation();
      onFollow(profile, !isFollowing);
    }}
  >
    ${isFollowing
      ? "Following"
      : isFollowedBy
        ? html`<app-icon icon="plus-line"></app-icon> Follow back`
        : html`<app-icon icon="plus-line"></app-icon> Follow`}
  </button>`;
}

function statsTemplate({ profile }) {
  return html`<div class="profile-hover-card-stats">
    <a
      class="profile-stat"
      data-testid="hover-card-followers-link"
      href="${linkToProfileFollowers(profile)}"
    >
      <strong>${formatLargeNumber(profile.followersCount)}</strong> followers
    </a>
    <a
      class="profile-stat"
      data-testid="hover-card-following-link"
      href="${linkToProfileFollowing(profile)}"
    >
      <strong>${formatLargeNumber(profile.followsCount)}</strong> following
    </a>
  </div>`;
}

function hoverCardTemplate({
  profile,
  isDetailed,
  currentUser,
  interactionHandlers,
  dataLayer,
}) {
  if (!profile) {
    return html`<div class="profile-hover-card-anim">
      ${loadingBodyTemplate()}
    </div>`;
  }
  const isCurrentUser = currentUser?.did === profile.did;
  const isLabeler = isLabelerProfile(profile);
  const isBlocking = !!profile.viewer?.blocking;
  const isBlockedBy = !!profile.viewer?.blockedBy;
  const isBlockingByList = !!profile.viewer?.blockingByList;
  const isBlocked = isBlocking || isBlockedBy || isBlockingByList;
  const isAuthenticated = !!currentUser;
  const followedBy = !!profile.viewer?.followedBy;
  const description = profile.description?.trim();
  const canShowCounts =
    isDetailed &&
    typeof profile.followersCount === "number" &&
    typeof profile.followsCount === "number";
  const isFollowPending = dataLayer.derived.$isFollowPending.get(profile.did);
  const displayName = getDisplayName(profile);

  return html`<div class="profile-hover-card-anim">
    <div class="profile-hover-card">
      <div class="profile-hover-card-header">
        <div class="profile-hover-card-avatar">
          ${avatarTemplate({ author: profile, clickAction: "link" })}
        </div>
        <div class="profile-hover-card-button-slot">
          ${followButtonTemplate({
            profile,
            isCurrentUser,
            isLabeler,
            isBlocking,
            isBlockedBy,
            isBlockingByList,
            isAuthenticated,
            isFollowPending,
            onFollow: (p, doFollow) =>
              interactionHandlers.profileInteractionHandler.handleFollow(
                p,
                doFollow,
              ),
          })}
        </div>
      </div>
      <a class="profile-hover-card-name-link" href="${linkToProfile(profile)}">
        <div class="profile-hover-card-name" data-testid="hover-card-name">
          ${displayName}${verificationBadgeTemplate({
            profile,
          })}${automatedAccountBadgeTemplate({ profile })}
        </div>
        <div class="profile-hover-card-handle-row">
          ${followedBy && !isBlocking && !isBlockedBy
            ? html`<span
                class="profile-follows-you"
                data-testid="hover-card-follows-you"
                >Follows you</span
              >`
            : null}
          <span class="profile-hover-card-handle"
            >${hasValidHandle(profile) ? `@${profile.handle}` : ""}</span
          >
        </div>
      </a>
      ${isBlocked
        ? null
        : html`
            ${canShowCounts ? statsTemplate({ profile }) : null}
            ${description
              ? html`<div class="profile-hover-card-bio">
                  <detected-rich-text
                    text=${description}
                    ?truncate-urls=${true}
                  ></detected-rich-text>
                </div>`
              : null}
            ${!isCurrentUser
              ? knownFollowersSummaryTemplate({ profile })
              : null}
          `}
    </div>
  </div>`;
}
