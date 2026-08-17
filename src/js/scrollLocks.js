import { resyncIOSFixedLayers } from "/js/iosFixedLayerResync.js";

function getHeaderElement(container) {
  const stickyElement = container.querySelector("[data-scroll-lock-sticky]");
  if (stickyElement && stickyElement.getBoundingClientRect().top <= 0) {
    return stickyElement;
  }
  return container.querySelector("header");
}

function lockScroll(container) {
  const header = getHeaderElement(container);
  let headerHeight = 0;
  if (header) {
    headerHeight = header.getBoundingClientRect().height;
    header.classList.add("scroll-lock-pinned");
  }
  // https://stackoverflow.com/a/19667968
  const main = container.querySelector("main");
  if (main) {
    const topMargin = -1 * (window.scrollY - headerHeight);
    main.style.marginTop = topMargin + "px";
    // Non-zero padding keeps the compensation margin from collapsing
    // with the first child's top margin
    main.style.paddingTop = "0.05px";
  }
  const body = document.body;
  body.style.position = "fixed";
  body.style.overflow = "hidden";
  body.style.top = "0";
  body.style.width = "100%";
  body.style.height = "100dvh";
  // Measure the column the header belongs to and pin the header to it.
  // Without this it would span the full viewport width.
  if (header) {
    const columnEl = header.parentElement;
    const columnRect = columnEl.getBoundingClientRect();
    const columnStyle = window.getComputedStyle(columnEl);
    const borderLeft = parseFloat(columnStyle.borderLeftWidth) || 0;
    const borderRight = parseFloat(columnStyle.borderRightWidth) || 0;
    header.style.left = columnRect.left + borderLeft + "px";
    header.style.width = columnRect.width - borderLeft - borderRight + "px";
    header.style.right = "auto";
  }
}

function unlockScroll(container, { restoreScroll = true } = {}) {
  const header = getHeaderElement(container);
  let headerHeight = 0;
  if (header) {
    headerHeight = header.getBoundingClientRect().height;
  }
  let scrollTo = 0;
  const main = container.querySelector("main");
  if (main) {
    scrollTo = -1 * (main.getBoundingClientRect().top - headerHeight);
    main.style.marginTop = "";
    main.style.paddingTop = "";
  }
  if (header) {
    header.classList.remove("scroll-lock-pinned");
  }
  if (header) {
    header.style.left = "";
    header.style.width = "";
    header.style.right = "";
  }
  const body = document.body;
  body.style.position = "";
  body.style.overflow = "";
  body.style.top = "";
  body.style.width = "";
  body.style.height = "";
  if (restoreScroll) {
    window.scrollTo(0, scrollTo);
  }
  resyncIOSFixedLayers();
}

function findScrollableAncestor(element) {
  let current = element.parentElement;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

class ScrollLockManager {
  #getContainer = null;
  #leases = new Set();
  #lockedContainer = null;

  setContainerProvider(getContainer) {
    this.#getContainer = getContainer;
  }

  acquire({ target = null } = {}) {
    let released = false;
    let lockedAncestor = null;
    let previousAncestorOverflow = "";
    const release = ({ restoreScroll = true } = {}) => {
      if (released) return;
      released = true;

      if (lockedAncestor) {
        lockedAncestor.style.overflow = previousAncestorOverflow;
        lockedAncestor = null;
        previousAncestorOverflow = "";
      }

      this.#leases.delete(release);
      if (this.#leases.size === 0 && this.#lockedContainer) {
        unlockScroll(this.#lockedContainer, { restoreScroll });
        this.#lockedContainer = null;
      }
    };

    if (this.#leases.size === 0) {
      const container = this.#getContainer?.();
      if (!container) {
        console.warn(
          "ScrollLock: no current page container found; skipping lock",
        );
        return { release };
      }
      lockScroll(container);
      this.#lockedContainer = container;
    }

    this.#leases.add(release);
    // Also prevent scroll in the nearest scrollable ancestor of the trigger.
    const ancestor = target ? findScrollableAncestor(target) : null;
    if (ancestor) {
      lockedAncestor = ancestor;
      previousAncestorOverflow = ancestor.style.overflow;
      ancestor.style.overflow = "hidden";
    }

    return { release };
  }
}

export const scrollLocks = new ScrollLockManager();
