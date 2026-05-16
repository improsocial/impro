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
  }
  const body = document.body;
  body.style.position = "fixed";
  body.style.overflow = "hidden";
  body.style.top = "0";
  body.style.width = "100%";
  body.style.height = "100vh";
  // Measure the column the header belongs to and pin the header to it.
  // Without this it would span the full viewport width.
  if (header) {
    const columnEl = header.parentElement;
    const columnRect = columnEl.getBoundingClientRect();
    header.style.left = columnRect.left + "px";
    header.style.width = columnRect.width + "px";
    header.style.right = "auto";
  }
}

function unlockScroll(container) {
  const header = getHeaderElement(container);
  let headerHeight = 0;
  if (header) {
    headerHeight = header.getBoundingClientRect().height;
    header.classList.remove("scroll-lock-pinned");
  }
  let scrollTo = 0;
  const main = container.querySelector("main");
  if (main) {
    scrollTo = -1 * (main.getBoundingClientRect().top - headerHeight);
    main.style.marginTop = "0";
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
  window.scrollTo(0, scrollTo);
}

let __activeScrollLock = null;

export class ScrollLock {
  constructor() {
    this.container = document.querySelector(".page-visible"); // todo find better way to get container
    this.locked = false;
  }

  lock() {
    if (__activeScrollLock) {
      // If scroll is already locked by another element, don't lock it again
      return;
    }
    if (this.locked) {
      return;
    }
    lockScroll(this.container);
    this.locked = true;
    __activeScrollLock = this;
  }

  unlock() {
    if (!this.locked) {
      return;
    }
    unlockScroll(this.container);
    this.locked = false;
    __activeScrollLock = null;
  }
}
