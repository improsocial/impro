import { html, keyed } from "/js/lib/lit-html.js";
import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToStarterPack } from "/js/navigation.js";
import "/js/components/container-link.js";

function starterPackListItemTemplate({
  starterPack,
  currentUser,
  testId = "starter-pack-list-item",
}) {
  const { record, creator } = starterPack;
  const isOwner = currentUser?.did === creator.did;
  const sampleProfiles = (starterPack.listItemsSample ?? [])
    .slice(0, 8)
    .map((item) => item.subject);
  const remainingCount =
    (starterPack.listItemCount ?? 0) - sampleProfiles.length;
  return html`<container-link
    class="feeds-list-item starter-pack-list-item clickable"
    data-testid=${testId}
    href=${linkToStarterPack(starterPack)}
  >
    <div class="feeds-list-item-avatar">
      <img
        src="/img/starter-pack-avatar-fallback.svg"
        alt=${record.name}
        class="feed-avatar"
      />
    </div>
    <div class="feeds-list-item-content">
      <div class="feeds-list-item-title">${record.name}</div>
      <div class="feeds-list-item-creator">
        Starter pack by ${isOwner ? "you" : html`@${creator.handle}`}
      </div>
      ${record.description
        ? // prettier-ignore
          html`<div class="feeds-list-item-description">${record.description}</div>`
        : ""}
      ${sampleProfiles.length > 0
        ? html`<div
            class="starter-pack-list-item-members"
            data-testid="starter-pack-members"
          >
            ${sampleProfiles.map((profile) =>
              keyed(
                profile.did,
                html`<div class="starter-pack-list-item-member">
                  ${avatarTemplate({
                    author: profile,
                    clickAction: "none",
                    showLiveBadge: false,
                  })}
                </div>`,
              ),
            )}
            ${remainingCount > 0
              ? html`<div class="starter-pack-list-item-member-count">
                  +${remainingCount}
                </div>`
              : ""}
          </div>`
        : ""}
    </div>
  </container-link>`;
}

function starterPackListItemSkeletonTemplate() {
  return html`<div
    class="feeds-list-item feeds-list-item-skeleton starter-pack-list-item"
    data-testid="feeds-list-item-skeleton"
  >
    <div class="feeds-list-item-avatar">
      <div class="feeds-list-item-skeleton-avatar skeleton-animate"></div>
    </div>
    <div class="feeds-list-item-content">
      <div class="feeds-list-item-title">
        <span class="starter-pack-list-item-skeleton-text skeleton-animate"
          >&#8203;</span
        >
      </div>
      <div class="feeds-list-item-creator">
        <span class="starter-pack-list-item-skeleton-text skeleton-animate"
          >&#8203;</span
        >
      </div>
      <div class="starter-pack-list-item-members">
        ${Array.from({ length: 6 }).map(
          () =>
            html`<div class="starter-pack-list-item-member">
              <div
                class="starter-pack-list-item-member-skeleton skeleton-animate"
              ></div>
            </div>`,
        )}
      </div>
    </div>
  </div>`;
}

export function starterPackListTemplate({
  starterPacks,
  cursor,
  currentUser,
  onLoadMore,
  emptyMessage = "No starter packs yet.",
  emptyTemplate = null,
  footerTemplate = null,
  itemTestId = "starter-pack-list-item",
}) {
  return paginatedListTemplate({
    items: starterPacks,
    renderItem: (starterPack) =>
      keyed(
        starterPack.uri,
        starterPackListItemTemplate({
          starterPack,
          currentUser,
          testId: itemTestId,
        }),
      ),
    renderSkeletonItem: starterPackListItemSkeletonTemplate,
    hasMore: !!cursor,
    onLoadMore,
    emptyMessage,
    emptyTemplate,
    footerTemplate,
  });
}
