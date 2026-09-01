import { EventEmitter, EventTarget } from "/js/eventEmitter.js";
import { effect, Signal } from "/js/signals.js";
import { BoundedMap, raf } from "/js/utils.js";

const MAX_PAGES = 5;

// Browsers fire auxclick rather than click for the middle button, so
// we need to manually dispatch a click event for it
function bindMiddleClickRedispatch() {
  if (window.__middleClickRedispatchBound) return;
  window.__middleClickRedispatchBound = true;
  window.addEventListener("auxclick", (event) => {
    if (event.button !== 1 || event.defaultPrevented) return;
    if (event.target.closest?.("a")) return;
    event.target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 1,
      }),
    );
  });
}

// Runs attach whenever the page becomes active (first entry or a return from
// the route cache) and detach when it's swapped out.
function bindActive(root, attach, detach) {
  root.addEventListener("page-show", attach);
  root.addEventListener("page-hide", detach);
}

// Lifecycle helpers

export function onPageShow(root, handler) {
  root.addEventListener("page-show", (event) => handler(event.detail));
}

export function onPageHide(root, handler) {
  root.addEventListener("page-hide", (event) => handler(event.detail));
}

export function bindToPage(root, source, event, handler) {
  if (!source) return;
  const usesEmitterApi = typeof source.on === "function";
  bindActive(
    root,
    () =>
      usesEmitterApi
        ? source.on(event, handler)
        : source.addEventListener(event, handler),
    () =>
      usesEmitterApi
        ? source.off(event, handler)
        : source.removeEventListener(event, handler),
  );
}

export class Layout extends EventTarget {
  slot = null;
  mount(container) {}
  dispose() {}
}

export function pageEffect(root, callback, options) {
  let dispose;
  bindActive(
    root,
    () => {
      dispose?.();
      dispose = effect(callback, options);
    },
    () => {
      dispose?.();
      dispose = null;
    },
  );
}

const APP_TITLE = document.title;

export function bindPageTitle(root, callback, options) {
  const titleCb = () => {
    const res = callback();
    document.title = res ? `${res} — ${APP_TITLE}` : APP_TITLE;
  };
  let dispose;
  const attach = () => {
    dispose?.();
    dispose = effect(titleCb, options);
  };
  const detach = () => {
    dispose?.();
    dispose = null;
    document.title = APP_TITLE;
  };
  bindActive(root, attach, detach);
}

export class Router extends EventEmitter {
  constructor() {
    super();
    this.routes = {};
    this.redirects = {};
    this.notFoundView = () => {};
    this.notFoundOptions = {};
    this.errorViewResolver = null;
    this.renderFunc = () => {};
    this.layout = null;
    this.containers = { default: null, bare: null, layout: null };
    this.currentPage = null;
    this.currentPath = null;
    this.$currentRoute = new Signal.State(null);
    this.pages = new BoundedMap(MAX_PAGES, {
      policy: "lru",
      onEvict: (path, page) => page.el.remove(),
    });
    this.scrollStates = new Map();
    bindMiddleClickRedispatch();
    // Disable scroll restoration
    window.history.scrollRestoration = "manual";
    // Save scroll when navigating away from the page
    window.addEventListener("pagehide", () => {
      if (this.currentPath != null) {
        this.scrollStates.set(this.currentPath, window.scrollY);
      }
    });
    // Restore scroll when returning from an external page
    window.addEventListener("pageshow", (e) => {
      if (e.persisted && this.currentPath != null) {
        const scrollY = this.scrollStates.get(this.currentPath) ?? 0;
        window.scrollTo(0, scrollY);
      }
    });
    // Any history traversal (back or forward button, swipe gesture, history.go)
    window.addEventListener("popstate", async (e) => {
      this.emit("navigate");
      await this.load(window.location.pathname + window.location.search, {
        isRestore: true,
      });
    });
  }

  addRoute(paths, viewGetter, options = {}) {
    for (const path of [].concat(paths)) {
      this.routes[path] = { viewGetter, options };
    }
  }

  addRedirects(redirects) {
    Object.assign(this.redirects, redirects);
  }

  matchRedirect(pathname) {
    for (const [pattern, redirect] of Object.entries(this.redirects)) {
      const params = Router.matchPath(pathname, pattern);
      if (params) {
        return redirect(params);
      }
    }
    return null;
  }

  renderRoute(renderFunc) {
    this.renderFunc = renderFunc;
  }

  setNotFoundView(viewGetter, options = {}) {
    this.notFoundView = viewGetter;
    this.notFoundOptions = options;
  }

  setErrorViewResolver(resolveErrorView) {
    this.errorViewResolver = resolveErrorView;
  }

  setLayout(layout) {
    this.layout = layout;
  }

  mount(root) {
    root.innerHTML = "";
    let layoutContainer = null;
    if (this.layout) {
      layoutContainer = document.createElement("div");
      root.append(layoutContainer);
      this.layout.mount(layoutContainer);
      if (!(this.layout.slot instanceof Element)) {
        throw new Error("Layout must expose a slot element for pages");
      }
    }
    const bareContainer = document.createElement("div");
    bareContainer.id = "bare-pages";
    root.append(bareContainer);
    this.containers = {
      default: this.layout ? this.layout.slot : root,
      bare: bareContainer,
      layout: layoutContainer,
    };
  }

  getScrollYForPath(path) {
    if (this.currentPath === path) return window.scrollY;
    return this.scrollStates.get(path) ?? 0;
  }

  #setLayoutHidden(hidden) {
    this.containers.layout?.classList.toggle("layout-hidden", hidden);
  }

  static matchPath(path, route) {
    const trimmedPath =
      path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
    const pathParts = trimmedPath.split("/");
    const routeParts = route.split("/");
    if (pathParts.length !== routeParts.length) {
      return null;
    }
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else {
        if (pathParts[i] !== routeParts[i]) {
          return null;
        }
      }
    }
    return params;
  }

  match(path) {
    // path: e.g. /profile/gracekind.net/post/3lykznxiikc2k
    // route: e.g. /profile/:handle/post/:rkey
    for (const [route, { viewGetter, options }] of Object.entries(
      this.routes,
    )) {
      const params = Router.matchPath(path, route);
      if (params) {
        return { route, viewGetter, params, options };
      }
    }
    return {
      route: null,
      viewGetter: this.notFoundView,
      params: {},
      options: this.notFoundOptions,
    };
  }

  hasRoute(path) {
    return this.match(path).route !== null;
  }

  async load(path, { isRestore = false } = {}) {
    const [pathnameForRedirect, query] = path.split("?");
    const redirectTarget = this.matchRedirect(pathnameForRedirect);
    if (redirectTarget !== null) {
      const redirectPath = query
        ? `${redirectTarget}?${query}`
        : redirectTarget;
      window.history.replaceState(window.history.state, "", redirectPath);
      return this.load(redirectPath, { isRestore });
    }
    // Save the scroll position of the page we're leaving before swapping it out
    if (this.currentPath != null) {
      this.scrollStates.set(this.currentPath, window.scrollY);
    }
    this.currentPath = path;
    // used to pause videos on page exit, among other things
    window.dispatchEvent(new CustomEvent("page-transition"));
    // Strip query parameters for route matching (but keep full path for caching)
    const pathname = path.split("?")[0];
    const outgoingPage = this.currentPage;
    if (outgoingPage) {
      // Safari can keep processing a focused search control after its page is
      // hidden. Release focus before moving the page into the route cache.
      const activeElement = document.activeElement;
      if (activeElement && outgoingPage.contains(activeElement)) {
        activeElement.blur();
      }
      outgoingPage.dispatchEvent(new CustomEvent("page-hide"));
    }
    if (this.pages.has(path)) {
      // Return to existing page
      const { el: page, routeInfo } = this.pages.get(path);
      this.currentPage = page;
      this.$currentRoute.set({ path, ...routeInfo });
      this.#setLayoutHidden(routeInfo.options.layout === false);
      const scrollY = this.scrollStates.get(path) ?? 0;
      this.currentPage.classList.remove("page-hidden");
      this.currentPage.classList.add("page-visible");
      // A same-path load reuses the outgoing page, which must stay visible
      if (outgoingPage !== page) {
        outgoingPage.classList.remove("page-visible");
        outgoingPage.classList.add("page-hidden");
      }
      // Scroll before dispatching so a "manual" view's own scroll wins
      const scrollRestore = routeInfo.options.scrollRestore ?? "back";
      switch (scrollRestore) {
        case "always":
          window.scrollTo(0, scrollY);
          break;
        case "back":
          window.scrollTo(0, isRestore ? scrollY : 0);
          break;
        case "manual":
          break;
        default:
          console.warn(`unknown scrollRestore type: ${scrollRestore}`);
      }
      // Let the swapped-in page paint before route effects and restore
      // handlers run, so iOS Safari has a live page to replace its
      // interactive back-swipe snapshot with.
      await raf();
      await raf();
      if (this.currentPage !== page || this.currentPath !== path) return;
      this.currentPage.dispatchEvent(
        new CustomEvent("page-show", {
          detail: { scrollY, action: isRestore ? "restore" : "advance" },
        }),
      );
      return;
    }
    // First load of new page
    const matchingRoute = this.match(pathname);
    const { route, viewGetter, params, options } = matchingRoute;
    const routeInfo = { route, params, options };
    this.$currentRoute.set({ path, ...routeInfo });
    this.#setLayoutHidden(options.layout === false);
    const view = await viewGetter();

    const newPage = document.createElement("div");
    newPage.classList.add("page", "page-hidden");
    const container =
      options.layout === false ? this.containers.bare : this.containers.default;
    container.appendChild(newPage);
    this.currentPage = newPage;
    this.pages.set(path, { el: newPage, routeInfo });
    window.scrollTo(0, 0);
    const layout = options.layout === false ? null : this.layout;
    try {
      await this.renderFunc({
        view,
        params,
        layout,
        container: newPage,
      });
    } catch (error) {
      const errorViewGetter = this.errorViewResolver?.(error, routeInfo);
      if (!errorViewGetter) {
        throw error;
      }
      const errorView = await errorViewGetter();
      newPage.replaceChildren();
      await this.renderFunc({
        view: errorView,
        params,
        layout,
        container: newPage,
      });
    }
    this.currentPage.classList.remove("page-hidden");
    this.currentPage.classList.add("page-visible");
    outgoingPage?.classList.remove("page-visible");
    outgoingPage?.classList.add("page-hidden");
    this.currentPage.dispatchEvent(
      new CustomEvent("page-show", {
        detail: { scrollY: 0, action: "advance" },
      }),
    );
  }

  _shouldOpenInNewTab() {
    // If last event was a click or Enter, check for modifier keys / middle button
    const event = window.event;
    if (!event) return false;
    if (event instanceof MouseEvent) {
      return (
        event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1
      );
    }
    return (
      event instanceof KeyboardEvent &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey || event.shiftKey)
    );
  }

  async go(path, { replace = false } = {}) {
    if (this._shouldOpenInNewTab()) {
      window.open(path, "_blank", "noopener");
      return;
    }
    if (path === this.currentPath) {
      return;
    }
    if (replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(
        { previousRoute: window.location.pathname },
        "",
        path,
      );
    }
    this.emit("navigate");
    await this.load(path);
  }

  async back({ fallbackRoute = null } = {}) {
    if (this._shouldOpenInNewTab()) {
      window.open(this.previousRoute ?? "/", "_blank", "noopener");
      return;
    }
    if (this.previousRoute !== null) {
      window.history.back();
    } else {
      this.go(fallbackRoute ?? "/", { replace: true });
    }
  }

  get previousRoute() {
    return window.history.state?.previousRoute ?? null;
  }
}
