import { Component } from "/js/components/component.js";

class ContainerLink extends Component {
  connectedCallback() {
    if (this.initialized) return;
    if (!this.hasAttribute("role")) this.setAttribute("role", "link");
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    this.addEventListener("click", this.onClick);
    this.addEventListener("keydown", this.onKeydown);
    this.addEventListener("mousedown", this.onMouseDown);
    this.initialized = true;
  }

  isNestedInteractive(target) {
    if (!target || target === this) return false;
    const interactive = target.closest(
      "a, button, input, textarea, select, [role=button], [role=link], [contenteditable]",
    );
    return interactive && interactive !== this && this.contains(interactive);
  }

  navigate(event) {
    const href = this.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    window.router.go(href);
  }

  hasTextSelectionWithin() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;
    if (selection.toString().length === 0) return false;
    const anchor = selection.anchorNode;
    return anchor != null && this.contains(anchor);
  }

  onClick = (event) => {
    if (event.defaultPrevented) return;
    if (this.isNestedInteractive(event.target)) return;
    if (this.hasTextSelectionWithin()) return;
    this.navigate(event);
  };

  onKeydown = (event) => {
    if (event.key !== "Enter") return;
    if (event.target !== this) return;
    this.navigate(event);
  };

  onMouseDown = (event) => {
    // Suppress the middle-button autoscroll cursor; the global auxclick
    // redispatch in router.js will fire our click handler on mouseup.
    if (event.button === 1) event.preventDefault();
  };
}

ContainerLink.register();
