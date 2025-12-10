import { EventEmitter } from "/js/eventEmitter.js";

const MAX_PAGES = 5;

export class Router extends EventEmitter {
  constructor() {
    super();
    this.routes = {};
    this.notFoundView = () => {};
    this.renderFunc = () => {};
    this.container = null;
    this.currentPage = null;
    this.pages = new Map();
    this.scrollStates = new Map();
    // Disable scroll restoration
    window.history.scrollRestoration = "manual";
    // on back button, go back to the previous page
    window.addEventListener("popstate", async (e) => {
      await this.load(window.location.pathname, { isBack: true });
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
        params[routeParts[i].slice(1)] = pathParts[i];
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

  async load(path, { isBack = false } = {}) {
    // used to pause videos on page exit
    window.dispatchEvent(new CustomEvent("page-transition"));
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
      // Keep page hidden during scroll restoration to prevent flash
      // this.currentPage.style.opacity = 0;
      this.currentPage.classList.remove("page-hidden");
      this.currentPage.classList.add("page-visible");
      this.currentPage.dispatchEvent(
        new CustomEvent("page-restore", {
          detail: {
            scrollY,
            isBack,
            showPage: () => {
              this.currentPage.style.opacity = 1;
            },
          },
        })
      );
      this.emit("page-shown", this.currentPage);
      return;
    }
    // First load of new page
    const matchingRoute = this.match(path);
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

  async go(path) {
    this.scrollStates.set(window.location.pathname, window.scrollY);
    window.history.pushState({ canGoBack: true }, "", path);
    await this.load(path);
  }

  async back() {
    this.scrollStates.set(window.location.pathname, window.scrollY);
    if (window.history.state?.canGoBack) {
      window.history.back();
    } else {
      this.go("/");
    }
  }
}
