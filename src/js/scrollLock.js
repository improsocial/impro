function lockScroll(container) {
  const header = container.querySelector("header");
  let headerHeight = 0;
  if (header) {
    headerHeight = header.getBoundingClientRect().height;
  }
  // https://stackoverflow.com/a/19667968
  const main = container.querySelector("main");
  if (main) {
    const topMargin = -1 * (window.scrollY - headerHeight);
    main.style.marginTop = topMargin + "px";
  }
  const body = document.body;
  body.classList.add("scroll-locked");
  body.style.position = "fixed";
  body.style.overflow = "hidden";
  // body.style.top = -top + "px";
  body.style.top = "0";
  body.style.width = "100%";
  body.style.height = "100vh";
  // window.scrollTo(0, top);
  // body.style.height = top + 5000 + "px";
}

function unlockScroll(container) {
  const header = container.querySelector("header");
  let headerHeight = 0;
  if (header) {
    headerHeight = header.getBoundingClientRect().height;
  }
  let scrollTo = 0;
  const main = container.querySelector("main");
  if (main) {
    scrollTo = -1 * (main.getBoundingClientRect().top - headerHeight);
    main.style.marginTop = "0";
  }
  const body = document.body;
  // const top = body.getBoundingClientRect().top - headerHeight;
  body.classList.remove("scroll-locked");
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
