import { Component, getChildrenFragment } from "./component.js";

class InfiniteScrollContainer extends Component {
  static get observedAttributes() {
    return ["disabled"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.label = this.getAttribute("label");
    this.expanded = false;
    this._children = getChildrenFragment(this);
    this.lookahead = this.getAttribute("lookahead") ?? "2000px";
    this.inverted = this.hasAttribute("inverted");
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "disabled" && this.observer && this.sentinel) {
      if (this.hasAttribute("disabled")) {
        this.observer.unobserve(this.sentinel);
      } else {
        this.observer.observe(this.sentinel);
      }
    }
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  render() {
    const container = document.createElement("div");
    container.classList.add("infinite-scroll-container");
    container.style.cssText = `
      position: relative;
    `;
    this.appendChild(container);
    container.appendChild(this._children);

    const sentinel = document.createElement("div");
    sentinel.classList.add("infinite-scroll-sentinel");
    const sentinelPosition = this.inverted ? "top: 0;" : "bottom: 0;";
    sentinel.style.cssText = `
      position: absolute;
      ${sentinelPosition}
      width: 1px;
      height: ${this.lookahead};
      max-height: 100%;
      background-color: transparent;
      pointer-events: none;
    `;

    if (this.inverted) {
      container.insertBefore(sentinel, container.firstChild);
    } else {
      container.appendChild(sentinel);
    }

    this.sentinel = sentinel;
    this.observer = this.initializeObserver(sentinel);
  }

  initializeObserver(sentinel) {
    const options = {
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (entry.isIntersecting && !this.hasAttribute("disabled")) {
        // Pause observing during load
        this.observer.unobserve(sentinel);

        this.dispatchEvent(
          new CustomEvent("load-more", {
            detail: {
              resume: () => {
                // Re-observe after the DOM/layout settles
                if (!this.hasAttribute("disabled")) {
                  requestAnimationFrame(() => {
                    // Force a reflow guard (GPT says this could help with iOS Safari)
                    sentinel.offsetTop;
                    this.observer.observe(sentinel);
                  });
                }
              },
            },
          }),
        );
      }
    }, options);

    if (!this.hasAttribute("disabled")) {
      requestAnimationFrame(() => observer.observe(sentinel));
    }

    return observer;
  }
}

InfiniteScrollContainer.register();
