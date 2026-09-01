import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { displayPreferences } from "/js/displayPreferences.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import "/js/components/container-link.js";
import "/js/components/app-icon.js";

const TREND_LIMIT = 5;

function trendingRowTemplate({ rank, label, href }) {
  return html`<container-link
    class="trending-row"
    data-testid="trending-row"
    href=${href}
  >
    <span class="trending-rank">${rank}.</span>
    <span class="trending-label">${label}</span>
  </container-link>`;
}

function trendingSkeletonTemplate() {
  return html`<div
    class="trending-row trending-row-skeleton"
    data-testid="trending-skeleton"
  >
    <span class="trending-rank">&#8203;</span>
    <span class="trending-label">
      &#8203;
      <span class="skeleton-animate trending-skeleton-bar"></span>
    </span>
  </div>`;
}

function trendingPaneTemplate({ rows, isLoading, onHide }) {
  return html`<section class="trending-pane" data-testid="trending-pane">
    <header class="trending-pane-header">
      <app-icon icon="pulse-line"></app-icon>
      <h2 class="trending-pane-title">Trending</h2>
      <button
        class="trending-hide-button"
        data-testid="trending-hide-button"
        aria-label="Trending options"
        @click=${onHide}
      >
        <app-icon icon="more-menu-line"></app-icon>
      </button>
    </header>
    <div class="trending-list">
      ${isLoading
        ? Array.from({ length: TREND_LIMIT }, () => trendingSkeletonTemplate())
        : rows.map((row) => trendingRowTemplate(row))}
    </div>
  </section>`;
}

function toRows(trends) {
  if (!trends) return [];
  const rows = [];
  for (const trend of trends) {
    const trendLink = trend.link;
    if (typeof trendLink !== "string" || !trendLink.startsWith("/")) continue;
    // "//host" and "/\host" are protocol-relative, so they would leave the app
    if (/^\/[/\\]/.test(trendLink)) continue;
    rows.push({
      rank: rows.length + 1,
      label: trend.displayName || trend.topic,
      href: trendLink,
    });
    if (rows.length === TREND_LIMIT) break;
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
        const hidden = displayPreferences.$trendingHidden.get();
        const failed = this.$failed.get();
        const trends = this.dataLayer.derived.$trends.get();
        const isLoading = !failed && trends === null;
        const rows = toRows(trends);
        if (hidden || failed || (!isLoading && rows.length === 0)) {
          render(html``, this);
          return;
        }
        render(
          trendingPaneTemplate({
            rows,
            isLoading,
            onHide: () => this.handleHide(),
          }),
          this,
        );
      }),
    ];
    this.load();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this.initialized = false;
  }

  async load() {
    try {
      await this.dataLayer.requests.loadTrends({ limit: TREND_LIMIT });
    } catch (error) {
      console.warn("Could not load trends", error);
    }
    if (this.dataLayer.derived.$trends.get() === null) {
      this.$failed?.set(true);
    }
  }

  async handleHide() {
    await confirmModal("You can turn this back on in Appearance settings.", {
      title: "Hide trending topics?",
      confirmButtonText: "Hide",
      onConfirm: () => displayPreferences.$trendingHidden.set(true),
    });
  }
}

TrendingPane.register();
