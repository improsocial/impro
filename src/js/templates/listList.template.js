import { html } from "/js/lib/lit-html.js";
import { cdnImageUrl, isModerationList } from "/js/dataHelpers.js";
import { linkToList } from "/js/navigation.js";
import "/js/components/container-link.js";
import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";

function listItemTemplate({ list }) {
  return html`
    <container-link
      class="feeds-list-item clickable"
      data-testid="feeds-list-item-list"
      href=${linkToList(list)}
    >
      <div class="feeds-list-item-avatar">
        <img
          src=${cdnImageUrl(list.avatar) || "/img/list-avatar-fallback.svg"}
          alt=${list.name}
          class="feed-avatar"
        />
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-title">${list.name}</div>
        ${list.creator
          ? html`<div class="feeds-list-item-creator">
              ${isModerationList(list) ? "Moderation list" : "List"} by
              @${list.creator.handle}
            </div>`
          : ""}
      </div>
    </container-link>
  `;
}

export function listListTemplate({ lists, cursor, onLoadMore }) {
  return paginatedListTemplate({
    items: lists,
    renderItem: (list) => listItemTemplate({ list }),
    hasMore: !!cursor,
    onLoadMore,
    emptyMessage: "No lists.",
  });
}
