import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";

function collapsibleContentTemplate({
  content,
  isExpanded,
  isOverflowing,
  showToggle,
  onToggle,
}) {
  return html`<div
      class=${classnames("collapsible-content-body", {
        "is-collapsed": !isExpanded,
        "is-overflowing": isOverflowing,
      })}
    >
      <div class="collapsible-content-inner">${content}</div>
    </div>
    ${showToggle
      ? html`<button
          class="collapsible-content-toggle"
          data-testid="collapsible-content-toggle"
          data-teststate=${isExpanded ? "expanded" : "collapsed"}
          aria-expanded=${isExpanded}
          @click=${onToggle}
        >
          ${isExpanded ? "Show less" : "Show more"}
        </button>`
      : null}`;
}

let sharedResizeObserver = null;

function getSharedResizeObserver() {
  if (!sharedResizeObserver) {
    sharedResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        entry.target.closest("collapsible-content")?.measureOverflow();
      }
    });
  }
  return sharedResizeObserver;
}

class CollapsibleContent extends Component {
  #content = null;
  #isExpanded = false;
  #isOverflowing = false;
  #observedInner = null;

  connectedCallback() {
    this.render();
    this.#observedInner = this.querySelector(".collapsible-content-inner");
    getSharedResizeObserver().observe(this.#observedInner);
  }

  disconnectedCallback() {
    if (this.#observedInner) {
      getSharedResizeObserver().unobserve(this.#observedInner);
      this.#observedInner = null;
    }
  }

  set content(value) {
    this.#content = value;
    if (this.isConnected) this.render();
  }

  get content() {
    return this.#content;
  }

  measureOverflow() {
    if (this.#isExpanded) return;
    const body = this.querySelector(".collapsible-content-body");
    const inner = this.querySelector(".collapsible-content-inner");
    const isOverflowing = inner.offsetHeight > body.clientHeight + 1;
    if (isOverflowing !== this.#isOverflowing) {
      this.#isOverflowing = isOverflowing;
      this.render();
    }
  }

  #handleToggle = (event) => {
    event.stopPropagation();
    this.#isExpanded = !this.#isExpanded;
    this.render();
    this.measureOverflow();
  };

  render() {
    const isExpandOnly = this.hasAttribute("expand-only");
    render(
      collapsibleContentTemplate({
        content: this.#content,
        isExpanded: this.#isExpanded,
        isOverflowing: this.#isOverflowing,
        showToggle: this.#isExpanded ? !isExpandOnly : this.#isOverflowing,
        onToggle: this.#handleToggle,
      }),
      this,
    );
  }
}

CollapsibleContent.register();
