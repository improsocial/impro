import { html } from "/js/lib/lit-html.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/app-icon.js";

export function feedLikeCountTemplate({ likeCount, className = "" }) {
  return html`<span
    class="feed-like-count ${className}"
    data-testid="feed-like-count"
    aria-label="${likeCount} ${likeCount === 1 ? "like" : "likes"}"
    ><app-icon icon="heart"></app-icon>${formatLargeNumber(likeCount)}</span
  >`;
}
