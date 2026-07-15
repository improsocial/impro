import { EventEmitter, EventTarget } from "/js/eventEmitter.js";
import { effect, Signal } from "/js/signals.js";

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

export function bindToPage(root, source, event, handler) {
  if (!source) return;
  const usesEmitterApi = typeof source.on === "function";
  const attach = () =>
    usesEmitterApi
      ? source.on(event, handler)
      : source.addEventListener(event, handler);
  const detach = () =>
    usesEmitterApi
      ? source.off(event, handler)
      : source.removeEventListener(event, handler);
  root.addEventListener("page-enter", attach);
  root.addEventListener("page-restore", attach);
  root.addEventListener("page-exit", detach);
}

export class Layout extends EventTarget {
  slot = null;
  mount(container) {}
  dispose() {}
}

export function pageEffect(root, callback, options) {
  let dispose;
  const attach = () => {
    dispose?.();
    dispose = effect(callback, options);
  };
  const detach = () => {
    dispose?.();
    dispose = null;
  };
  root.addEventListener("page-enter", attach);
  root.addEventListener("page-restore", attach);
  root.addEventListener("page-exit", detach);
}

export class Router extends EventEmitter {
  constructor() {
    super();
    this.routes = {};
    this.redirects = {};
    this.notFoundView = () => {};
    this.notFoundOptions = {};
    this.renderFunc = () => {};
    this.layout = null;
    this.containers = { default: null, bare: null, layout: null };
    this.currentPage = null;
    this.currentPath = null;
    this.$currentRoute = new Signal.State(null);
    this.pages = new Map();
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
    // on back button, go back to the previous page
    window.addEventListener("popstate", async (e) => {
      this.emit("navigate");
      await this.load(window.location.pathname + window.location.search, {
        isBack: true,
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

  setLayout(layout) {
    this.layout = layout;
  }

  mount(root) {
    // Clear any pre-mount loading state
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

  async load(path, { isBack = false } = {}) {
    const [pathnameForRedirect, query] = path.split("?");
    const redirectTarget = this.matchRedirect(pathnameForRedirect);
    if (redirectTarget !== null) {
      const redirectPath = query
        ? `${redirectTarget}?${query}`
        : redirectTarget;
      window.history.replaceState(window.history.state, "", redirectPath);
      return this.load(redirectPath, { isBack });
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
    if (this.currentPage) {
      // Safari can keep processing a focused search control after its page is
      // hidden. Release focus before moving the page into the route cache.
      const activeElement = document.activeElement;
      if (activeElement && this.currentPage.contains(activeElement)) {
        activeElement.blur();
      }
      this.currentPage.dispatchEvent(new CustomEvent("page-exit"));
      this.currentPage.classList.remove("page-visible");
      this.currentPage.classList.add("page-hidden");
    }
    if (this.pages.has(path)) {
      // Return to existing page
      const { el: page, routeInfo } = this.pages.get(path);
      this.currentPage = page;
      // Re-insert the page so it's at the end of the stack
      // This means the least recently used page is always at the start of the stack
      this.pages.delete(path);
      this.pages.set(path, { el: page, routeInfo });
      this.$currentRoute.set({ path, ...routeInfo });
      this.#setLayoutHidden(routeInfo.options.layout === false);
      const scrollY = this.scrollStates.get(path) ?? 0;
      this.currentPage.classList.remove("page-hidden");
      this.currentPage.classList.add("page-visible");
      this.currentPage.dispatchEvent(
        new CustomEvent("page-restore", {
          detail: {
            scrollY,
            isBack,
          },
        }),
      );
      this.emit("page-shown", this.currentPage);
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
    newPage.classList.add("page", "page-visible");
    const container =
      options.layout === false ? this.containers.bare : this.containers.default;
    container.appendChild(newPage);
    this.currentPage = newPage;
    this.pages.set(path, { el: newPage, routeInfo });
    // Limit stored pages to prevent memory leaks / performance issues
    if (this.pages.size > MAX_PAGES) {
      const firstPageKey = this.pages.keys().next().value;
      const firstPage = this.pages.get(firstPageKey);
      firstPage.el.remove();
      this.pages.delete(firstPageKey);
    }
    window.scrollTo(0, 0);
    await this.renderFunc({
      view,
      params,
      layout: options.layout === false ? null : this.layout,
      container: this.currentPage,
    });
    this.currentPage.dispatchEvent(new CustomEvent("page-enter"));
    this.emit("page-shown", this.currentPage);
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
