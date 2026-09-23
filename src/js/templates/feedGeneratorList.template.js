import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";

export function feedGeneratorListTemplate({
  feedGenerators,
  cursor = null,
  currentUserDid,
  onLoadMore = null,
  emptyMessage = "No feeds.",
  showDescription = false,
  rightItemTemplate = null,
}) {
  return paginatedListTemplate({
    items: feedGenerators,
    renderItem: (feedGenerator) =>
      feedGeneratorListItemTemplate({
        feedGenerator,
        currentUserDid,
        showDescription,
        rightItemTemplate,
      }),
    hasMore: !!cursor,
    onLoadMore,
    emptyMessage,
  });
}
