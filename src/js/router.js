import { EventEmitter } from "/js/eventEmitter.js";
import { effect } from "/js/signals.js";

const MAX_PAGES = 5;

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
    this.notFoundView = () => {};
    this.renderFunc = () => {};
    this.container = null;
    this.currentPage = null;
    this.currentPath = null;
    this.pages = new Map();
    this.scrollStates = new Map();
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

  addRoute(path, viewGetter) {
    this.routes[path] = { viewGetter };
  }

  renderRoute(renderFunc) {
    this.renderFunc = renderFunc;
  }

  setNotFoundView(viewGetter) {
    this.notFoundView = viewGetter;
  }

  mount(container) {
    container.innerHTML = "";
    this.container = container;
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
    for (const [route, { viewGetter }] of Object.entries(this.routes)) {
      const params = Router.matchPath(path, route);
      if (params) {
        return { route, viewGetter, params };
      }
    }
    return { route: null, viewGetter: this.notFoundView, params: {} };
  }

  hasRoute(path) {
    return this.match(path).route !== null;
  }

  async load(path, { isBack = false } = {}) {
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
      this.currentPage.dispatchEvent(new CustomEvent("page-exit"));
      this.currentPage.classList.remove("page-visible");
      this.currentPage.classList.add("page-hidden");
    }
    if (this.pages.has(path)) {
      // Return to existing page
      const page = this.pages.get(path);
      this.currentPage = page;
      // Re-insert the page so it's at the end of the stack
      // This means the least recently used page is always at the start of the stack
      this.pages.delete(path);
      this.pages.set(path, page);
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
    const { viewGetter, params } = matchingRoute;
    const view = await viewGetter();

    const newPage = document.createElement("div");
    newPage.classList.add("page", "page-visible");
    this.container.appendChild(newPage);
    this.currentPage = newPage;
    this.pages.set(path, newPage);
    // Limit stored pages to prevent memory leaks / performance issues
    if (this.pages.size > MAX_PAGES) {
      const firstPageKey = this.pages.keys().next().value;
      const firstPage = this.pages.get(firstPageKey);
      firstPage.remove();
      this.pages.delete(firstPageKey);
    }
    window.scrollTo(0, 0);
    await this.renderFunc({
      view,
      params,
      container: this.currentPage,
    });
    this.currentPage.dispatchEvent(new CustomEvent("page-enter"));
    this.emit("page-shown", this.currentPage);
  }

  _shouldOpenInNewTab() {
    // If last event was a click or Enter, check for meta key
    const event = window.event;
    if (!event || (!event.metaKey && !event.ctrlKey)) return false;
    if (event instanceof MouseEvent) return true;
    return event instanceof KeyboardEvent && event.key === "Enter";
  }

  async go(path) {
    if (this._shouldOpenInNewTab()) {
      window.open(path, "_blank");
      return;
    }
    window.history.pushState(
      { previousRoute: window.location.pathname },
      "",
      path,
    );
    this.emit("navigate");
    await this.load(path);
  }

  async back() {
    if (this._shouldOpenInNewTab()) {
      window.open(this.previousRoute ?? "/", "_blank");
      return;
    }
    if (!!window.history.state?.previousRoute) {
      window.history.back();
    } else {
      this.go("/");
    }
  }

  get previousRoute() {
    return window.history.state?.previousRoute ?? null;
  }
}
