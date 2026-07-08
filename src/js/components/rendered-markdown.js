import { Component } from "/js/components/component.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";

class RenderedMarkdown extends Component {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.state = new ReactiveStore("rendered-markdown");
    this.state.$dependencies = new Signal.State(null);
    this.state.$content = new Signal.State(this.getAttribute("content") || "");
    // Fetch dependencies
    Promise.all([
      import("/js/lib/dompurify.js"),
      import("/js/lib/marked.js"),
    ]).then(([{ default: DOMPurify }, { marked }]) => {
      this.state.$dependencies.set({ DOMPurify, marked });
    });
    this.dispose = effect(() => {
      const dependencies = this.state.$dependencies.get();
      if (!dependencies) return;
      const { DOMPurify, marked } = dependencies;
      const content = this.state.$content.get();
      this.innerHTML = DOMPurify.sanitize(marked.parse(content));
    });
    // Treat links inside rendered markdown as external
    this.onLinkClick = (event) => {
      if (event.target.closest("a")) {
        event.stopPropagation();
      }
    };
    this.addEventListener("click", this.onLinkClick);
  }

  static get observedAttributes() {
    return ["content"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "content") {
      this.state.$content.set(newValue);
    }
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this.dispose?.();
    this.dispose = null;
    this.removeEventListener("click", this.onLinkClick);
  }
}

RenderedMarkdown.register();
