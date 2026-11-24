import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { formatRelativeTime, whenElementVisible } from "/js/utils.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { sidebarPaneTemplate } from "/js/templates/sidebarPane.template.js";
import {
  avatarPlaceholderTemplate,
  avatarTemplate,
} from "/js/templates/avatar.template.js";
import "/js/components/container-link.js";

const TREND_LIMIT = 3;
const TREND_POOL_SIZE = 10;
const TREND_AVATAR_LIMIT = 3;
const ACTIVE_STATUSES = ["hot", "trending"];
const CATEGORY_LABELS = {
  politics: "Politics",
  entertainment: "Entertainment",
  "pop-culture": "Entertainment",
  culture: "Culture",
  business: "Business",
  sports: "Sports",
  "science-tech": "Science & Tech",
  "video-games": "Video Games",
  news: "News",
  other: "Other",
};

function pluralize(count, noun) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

function trendingAvatarsTemplate({ actors }) {
  if (actors.length === 0) return "";
  return html`<div class="trending-avatars" data-testid="trending-avatars">
    ${actors.map((actor) =>
      avatarTemplate({
        author: actor,
        clickAction: "none",
        showLiveStatus: false,
      }),
    )}
  </div>`;
}

function trendingRowTemplate({
  label,
  href,
  actors,
  isActive,
  age,
  category,
  postCount,
}) {
  return html`<container-link
    class="trending-row"
    data-testid="trending-row"
    href=${href}
  >
    <div class="trending-heading">
      <div class="trending-title" data-testid="trending-title">${label}</div>
      <span
        class="trending-time"
        data-testid="trending-status"
        data-teststate=${isActive ? "active" : "past"}
        >${isActive ? "Now" : age}</span
      >
    </div>
    <div class="trending-meta">
      ${trendingAvatarsTemplate({ actors })}
      <div class="trending-meta-text">
        ${category
          ? html`<span
              class="trending-meta-item"
              data-testid="trending-category"
              >${category}</span
            >`
          : ""}<span
          class="trending-meta-item"
          data-testid="trending-post-count"
          >${postCount}</span
        >
      </div>
    </div>
  </container-link>`;
}

function trendingSkeletonTemplate() {
  return html`<div
    class="trending-row trending-row-skeleton"
    data-testid="trending-skeleton"
  >
    <div class="trending-heading">
      <div class="trending-title">
        &#8203;
        <span class="skeleton-animate trending-skeleton-bar"></span>
      </div>
    </div>
    <div class="trending-meta">
      <div class="trending-avatars">
        ${Array.from({ length: TREND_AVATAR_LIMIT }, () =>
          avatarPlaceholderTemplate(),
        )}
      </div>
      <div class="trending-meta-text">
        &#8203;
        <span
          class="skeleton-animate trending-skeleton-bar trending-skeleton-bar-meta"
        ></span>
      </div>
    </div>
  </div>`;
}

function trendingPaneTemplate({ rows, isLoading, isAuthenticated, onDismiss }) {
  return sidebarPaneTemplate({
    className: "trending-pane",
    testId: "trending-pane",
    title: "Trending",
    dismissLabel: "Hide trending topics",
    dismissTestId: "trending-dismiss-button",
    onDismiss: isAuthenticated ? onDismiss : null,
    children: html`<div
      class="trending-list ${isLoading ? "loading-block" : ""}"
    >
      ${isLoading
        ? Array.from({ length: TREND_LIMIT }, () => trendingSkeletonTemplate())
        : rows.map((row) => trendingRowTemplate(row))}
    </div>`,
  });
}

const sampledRowsCache = new WeakMap();

function sampleInOrder(items, count) {
  const indices = items.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((index) => items[index]);
}

function toSampledRows(trends) {
  if (!trends) return [];
  if (!sampledRowsCache.has(trends)) {
    sampledRowsCache.set(trends, sampleInOrder(toRows(trends), TREND_LIMIT));
  }
  return sampledRowsCache.get(trends);
}

function toRows(trends) {
  const rows = [];
  for (const trend of trends) {
    const trendLink = trend.link;
    if (typeof trendLink !== "string" || !trendLink.startsWith("/")) continue;
    // "//host" and "/\host" are protocol-relative, so they would leave the app
    if (/^\/[/\\]/.test(trendLink)) continue;
    rows.push({
      label: trend.displayName || trend.topic,
      href: trendLink,
      actors: trend.actors.slice(0, TREND_AVATAR_LIMIT),
      isActive: ACTIVE_STATUSES.includes(trend.status),
      age: formatRelativeTime(trend.startedAt),
      category: CATEGORY_LABELS[trend.category] ?? null,
      postCount: pluralize(trend.postCount, "post"),
    });
  }
  return rows;
}

class TrendingPane extends Component {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.dataLayer) {
      throw new Error("trending-pane requires a dataLayer property");
    }
    this.$failed = new Signal.State(false);
    this._disposers = [
      effect(() => {
        const hidden = this.dataLayer.derived.$trendingHidden.get();
        const failed = this.$failed.get();
        const trends = this.dataLayer.derived.$trends.get();
        const isLoading = !failed && trends === null;
        const rows = toSampledRows(trends);
        if (hidden || failed || (!isLoading && rows.length === 0)) {
          render(html``, this);
          return;
        }
        render(
          trendingPaneTemplate({
            rows,
            isLoading,
            isAuthenticated: this.isAuthenticated,
            onDismiss: () => this.handleHide(),
          }),
          this,
        );
      }),
      whenElementVisible(this, () => this.load()),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this.initialized = false;
  }

  async load() {
    try {
      await this.dataLayer.requests.loadTrends({ limit: TREND_POOL_SIZE });
    } catch (error) {
      console.warn("Could not load trends", error);
    }
    if (this.dataLayer.derived.$trends.get() === null) {
      this.$failed?.set(true);
    }
  }

  async handleHide() {
    await confirmModal(
      "You can turn this back on in Content and Media settings.",
      {
        title: "Hide trending topics?",
        confirmButtonText: "Hide",
        onConfirm: () => this.dataLayer.mutations.setTrendingHidden(true),
      },
    );
  }
}

TrendingPane.register();
