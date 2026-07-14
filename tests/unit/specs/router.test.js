import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Router, Layout } from "/js/router.js";

class TestLayout extends Layout {
  constructor() {
    super();
    this.slot = document.createElement("div");
    this.mountedInto = null;
  }
  mount(container) {
    this.mountedInto = container;
    container.appendChild(this.slot);
  }
}

function mountRouter(router, { layout = null } = {}) {
  const root = document.createElement("div");
  if (layout) {
    router.setLayout(layout);
  }
  router.mount(root);
  return {
    root,
    defaultContainer: router.containers.default,
    bareContainer: router.containers.bare,
    layoutContainer: router.containers.layout,
  };
}

describe("constructor and initialization", () => {
  it("should initialize with empty routes", () => {
    const router = new Router();
    assert.deepEqual(Object.keys(router.routes).length, 0);
  });

  it("should initialize with default notFoundView", () => {
    const router = new Router();
    assert(typeof router.notFoundView === "function");
  });

  it("should initialize with null containers", () => {
    const router = new Router();
    assert.deepEqual(router.containers, {
      default: null,
      bare: null,
      layout: null,
    });
  });

  it("should initialize with a null current route", () => {
    const router = new Router();
    assert.deepEqual(router.$currentRoute.get(), null);
  });
});

describe("addRoute", () => {
  it("should add a route with viewGetter", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/test", viewGetter);
    assert(router.routes["/test"]);
    assert.deepEqual(router.routes["/test"].viewGetter, viewGetter);
  });

  it("should add multiple routes", () => {
    const router = new Router();
    router.addRoute("/path1", () => {});
    router.addRoute("/path2", () => {});
    assert.deepEqual(Object.keys(router.routes).length, 2);
  });

  it("should register every path in an array under the same view and options", () => {
    const router = new Router();
    const viewGetter = () => "view";
    const options = { layoutOptions: { activeNavItem: "home" } };
    router.addRoute(["/", "/intent/compose"], viewGetter, options);

    assert.deepEqual(Object.keys(router.routes), ["/", "/intent/compose"]);
    assert.deepEqual(router.match("/intent/compose").viewGetter, viewGetter);
    assert.deepEqual(router.match("/intent/compose").options, options);
    assert.deepEqual(router.match("/").viewGetter, viewGetter);
  });
});

describe("setNotFoundView", () => {
  it("should set notFoundView function", () => {
    const router = new Router();
    const notFoundView = () => "404";
    router.setNotFoundView(notFoundView);
    assert.deepEqual(router.notFoundView, notFoundView);
  });
});

describe("mount", () => {
  it("should default pages to the root and create the bare container", () => {
    const router = new Router();
    const { root, defaultContainer, bareContainer } = mountRouter(router);
    assert.deepEqual(defaultContainer, root);
    assert.deepEqual(bareContainer, root.querySelector("#bare-pages"));
  });

  it("should mount the layout into a router-created container and use its slot for pages", () => {
    const router = new Router();
    const layout = new TestLayout();
    const { root, defaultContainer, bareContainer, layoutContainer } =
      mountRouter(router, { layout });
    assert.deepEqual(layout.mountedInto, layoutContainer);
    assert.deepEqual(layoutContainer.parentElement, root);
    assert(layoutContainer.contains(layout.slot));
    assert.deepEqual(defaultContainer, layout.slot);
    assert.deepEqual(bareContainer, root.querySelector("#bare-pages"));
  });

  it("should clear pre-existing root contents", () => {
    const router = new Router();
    const root = document.createElement("div");
    root.innerHTML = "<p>stale ssr/loading markup</p>";
    router.mount(root);
    assert.deepEqual(root.querySelector("p"), null);
  });

  it("should throw when the layout does not expose a slot element", () => {
    const router = new Router();
    const slotlessLayout = new Layout();
    router.setLayout(slotlessLayout);
    assert.throws(
      () => router.mount(document.createElement("div")),
      /slot element/,
    );
  });
});

describe("matchPath (static method)", () => {
  it("should match exact path", () => {
    const params = Router.matchPath("/test", "/test");
    assert.deepEqual(params, {});
  });

  it("should return null for non-matching paths", () => {
    const params = Router.matchPath("/test", "/other");
    assert.deepEqual(params, null);
  });

  it("should extract single parameter", () => {
    const params = Router.matchPath("/user/john", "/user/:name");
    assert.deepEqual(params, { name: "john" });
  });

  it("should extract multiple parameters", () => {
    const params = Router.matchPath(
      "/profile/gracekind.net/post/3lykznxiikc2k",
      "/profile/:handle/post/:rkey",
    );
    assert.deepEqual(params, {
      handle: "gracekind.net",
      rkey: "3lykznxiikc2k",
    });
  });

  it("should return null for different path lengths", () => {
    const params = Router.matchPath("/test/extra", "/test");
    assert.deepEqual(params, null);
  });

  it("should handle empty path segments", () => {
    const params = Router.matchPath("/", "/");
    assert.deepEqual(params, {});
  });

  it("should match path with parameter at start", () => {
    const params = Router.matchPath("/john/profile", "/:name/profile");
    assert.deepEqual(params, { name: "john" });
  });

  it("should decode percent-encoded path parameters", () => {
    const params = Router.matchPath("/hashtag/hello%20world", "/hashtag/:tag");
    assert.deepEqual(params, { tag: "hello world" });
  });

  it("should decode encoded slashes in parameters", () => {
    const params = Router.matchPath(
      "/profile/alice%2Fevil/post/abc123",
      "/profile/:handle/post/:rkey",
    );
    assert.deepEqual(params, { handle: "alice/evil", rkey: "abc123" });
  });

  it("should preserve colons in DID parameters", () => {
    const params = Router.matchPath(
      "/profile/did:plc:abc123/post/key456",
      "/profile/:handle/post/:rkey",
    );
    assert.deepEqual(params, { handle: "did:plc:abc123", rkey: "key456" });
  });
});

describe("match", () => {
  it("should match existing route", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/test", viewGetter);
    const result = router.match("/test");
    assert.deepEqual(result.route, "/test");
    assert.deepEqual(result.viewGetter, viewGetter);
    assert.deepEqual(result.params, {});
  });

  it("should match route with parameters", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/user/:id", viewGetter);
    const result = router.match("/user/123");
    assert.deepEqual(result.route, "/user/:id");
    assert.deepEqual(result.params, { id: "123" });
  });

  it("should return notFoundView for non-matching path", () => {
    const router = new Router();
    const notFoundView = () => "404";
    router.setNotFoundView(notFoundView);
    const result = router.match("/nonexistent");
    assert.deepEqual(result.route, null);
    assert.deepEqual(result.viewGetter, notFoundView);
    assert.deepEqual(result.params, {});
  });

  it("should match first matching route", () => {
    const router = new Router();
    const view1 = () => "view1";
    const view2 = () => "view2";
    router.addRoute("/user/:id", view1);
    router.addRoute("/user/:name", view2);
    const result = router.match("/user/123");
    assert.deepEqual(result.viewGetter, view1);
  });
});

describe("renderRoute", () => {
  it("should set renderFunc", () => {
    const router = new Router();
    const renderFunc = () => {};
    router.renderRoute(renderFunc);
    assert.deepEqual(router.renderFunc, renderFunc);
  });
});

describe("popstate", () => {
  // Capture the Router's popstate handler rather than dispatching a global
  // popstate event, since previously-created Router instances in other tests
  // also have popstate listeners on window and would fire here.
  function createRouterWithPopstateHandler() {
    const origAdd = window.addEventListener.bind(window);
    let popstateHandler = null;
    window.addEventListener = (event, handler, options) => {
      if (event === "popstate" && popstateHandler === null) {
        popstateHandler = handler;
      } else {
        origAdd(event, handler, options);
      }
    };
    const router = new Router();
    window.addEventListener = origAdd;
    return { router, popstateHandler };
  }

  it("should emit navigate event when popstate fires", async () => {
    const { router, popstateHandler } = createRouterWithPopstateHandler();
    mountRouter(router);

    const listener = mock.fn();
    router.on("navigate", listener);

    await popstateHandler(new Event("popstate"));

    assert.deepEqual(listener.mock.callCount(), 1);
  });

  it("should emit navigate before loading the new page", async () => {
    const { router, popstateHandler } = createRouterWithPopstateHandler();
    mountRouter(router);

    const order = [];
    router.on("navigate", () => order.push("navigate"));
    router.on("page-shown", () => order.push("page-shown"));

    await popstateHandler(new Event("popstate"));

    assert.deepEqual(order[0], "navigate");
  });

  it("restores a query-bearing page from cache on back navigation", async () => {
    const originalPath =
      window.location.pathname + window.location.search + window.location.hash;
    const originalState = window.history.state;
    const { router, popstateHandler } = createRouterWithPopstateHandler();
    mountRouter(router);
    router.addRoute("/search", () => Promise.resolve({}));
    router.addRoute("/other", () => Promise.resolve({}));
    router.renderRoute(() => {});

    try {
      await router.load("/search?q=alice");
      const searchPage = router.pages.get("/search?q=alice")?.el;
      assert(searchPage, "page should be cached under its full path");
      await router.load("/other");

      // Simulate the back button landing on the query-bearing URL.
      window.history.replaceState({}, "", "/search?q=alice");
      await popstateHandler(new Event("popstate"));

      // The cached page is reused rather than rebuilt under the query-less path.
      assert(
        router.currentPage === searchPage,
        "should reuse the cached query-bearing page",
      );
      assert(
        !router.pages.has("/search"),
        "should not create a query-less duplicate page",
      );
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

describe("load", () => {
  it("should load route and render view", async () => {
    const router = new Router();
    const { defaultContainer } = mountRouter(router);

    const view = { name: "TestView" };
    const viewGetter = () => Promise.resolve(view);
    router.addRoute("/test", viewGetter);

    let renderCalled = false;
    let renderArgs = null;
    router.renderRoute((args) => {
      renderCalled = true;
      renderArgs = args;
    });

    await router.load("/test");

    assert(renderCalled);
    assert.deepEqual(renderArgs.view, view);
    assert.deepEqual(renderArgs.params, {});
    assert(renderArgs.container);
    assert(defaultContainer.contains(renderArgs.container));
  });

  it("should pass route parameters to renderFunc", async () => {
    const router = new Router();
    mountRouter(router);

    router.addRoute("/user/:id", () => Promise.resolve({}));

    let receivedParams = null;
    router.renderRoute((args) => {
      receivedParams = args.params;
    });

    await router.load("/user/123");

    assert.deepEqual(receivedParams, { id: "123" });
  });
});

describe("go", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should emit navigate event before loading the new page", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/go-test", () => Promise.resolve({}));

    const order = [];
    router.on("navigate", () => order.push("navigate"));
    router.on("page-shown", () => order.push("page-shown"));

    try {
      await router.go("/go-test");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }

    assert.deepEqual(order[0], "navigate");
    assert.deepEqual(order[1], "page-shown");
  });

  it("should store the previous route in history state", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/go-prev-test", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/starting-path");

    try {
      await router.go("/go-prev-test");
      assert.deepEqual(window.history.state?.previousRoute, "/starting-path");
      assert.deepEqual(window.location.pathname, "/go-prev-test");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should replace the current history entry when called with replace: true", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/go-replace-test", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/starting-path");
    const lengthBefore = window.history.length;

    try {
      await router.go("/go-replace-test", { replace: true });
      assert.deepEqual(window.location.pathname, "/go-replace-test");
      assert.deepEqual(window.history.length, lengthBefore);
      assert.deepEqual(window.history.state?.previousRoute, undefined);
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

describe("modifier-click navigation", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;
  const originalOpen = window.open;
  let openMock;
  let button;

  beforeEach(() => {
    openMock = mock.fn();
    window.open = openMock;
    button = document.createElement("button");
    document.body.appendChild(button);
  });

  afterEach(() => {
    window.open = originalOpen;
    button.remove();
    window.history.replaceState(originalState, "", originalPath);
  });

  function click(modifiers = {}) {
    button.dispatchEvent(new MouseEvent("click", modifiers));
  }

  it("should open in a new tab on cmd+click instead of navigating", () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/meta-test", () => Promise.resolve({}));

    let navigated = false;
    router.on("navigate", () => (navigated = true));
    window.history.replaceState(null, "", "/starting-path");
    button.addEventListener("click", () => router.go("/meta-test"));

    click({ metaKey: true });

    assert.deepEqual(openMock.mock.callCount(), 1);
    assert.deepEqual(openMock.mock.calls[0].arguments, [
      "/meta-test",
      "_blank",
      "noopener",
    ]);
    assert.deepEqual(navigated, false);
    assert.deepEqual(window.location.pathname, "/starting-path");
  });

  it("should open in a new tab on ctrl+click", () => {
    const router = new Router();
    button.addEventListener("click", () => router.go("/ctrl-test"));

    click({ ctrlKey: true });

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/ctrl-test", "_blank", "noopener"]],
    );
  });

  it("should navigate normally on unmodified click", () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/plain-test", () => Promise.resolve({}));
    button.addEventListener("click", () => router.go("/plain-test"));

    click();

    assert.deepEqual(openMock.mock.callCount(), 0);
    assert.deepEqual(window.location.pathname, "/plain-test");
  });

  it("should open in a new tab on cmd+Enter", () => {
    const router = new Router();
    button.addEventListener("keydown", () => router.go("/enter-test"));

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", metaKey: true }),
    );

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/enter-test", "_blank", "noopener"]],
    );
  });

  it("should navigate normally when metaKey is held on a non-Enter key", () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/keyboard-test", () => Promise.resolve({}));
    button.addEventListener("keydown", () => router.go("/keyboard-test"));

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );

    assert.deepEqual(openMock.mock.callCount(), 0);
    assert.deepEqual(window.location.pathname, "/keyboard-test");
  });

  it("should open the previous route in a new tab on cmd+click of back", () => {
    const router = new Router();
    window.history.replaceState({ previousRoute: "/prior-path" }, "", "/here");
    button.addEventListener("click", () => router.back());

    click({ metaKey: true });

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/prior-path", "_blank", "noopener"]],
    );
    assert.deepEqual(window.location.pathname, "/here");
  });

  it("should open home in a new tab on cmd+click of back without history", () => {
    const router = new Router();
    window.history.replaceState(null, "", "/here");
    button.addEventListener("click", () => router.back());

    click({ metaKey: true });

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/", "_blank", "noopener"]],
    );
  });
});

describe("middle-click navigation", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;
  const originalOpen = window.open;
  let openMock;
  let button;

  beforeEach(() => {
    openMock = mock.fn();
    window.open = openMock;
    button = document.createElement("button");
    document.body.appendChild(button);
  });

  afterEach(() => {
    window.open = originalOpen;
    button.remove();
    window.history.replaceState(originalState, "", originalPath);
  });

  function middleClick(target, options = {}) {
    target.dispatchEvent(
      new MouseEvent("auxclick", { button: 1, bubbles: true, ...options }),
    );
  }

  it("should open in a new tab on middle click instead of navigating", () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/middle-test", () => Promise.resolve({}));

    let navigated = false;
    router.on("navigate", () => (navigated = true));
    window.history.replaceState(null, "", "/starting-path");
    button.addEventListener("click", () => router.go("/middle-test"));

    middleClick(button);

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/middle-test", "_blank", "noopener"]],
    );
    assert.deepEqual(navigated, false);
    assert.deepEqual(window.location.pathname, "/starting-path");
  });

  it("should open the previous route in a new tab on middle click of back", () => {
    const router = new Router();
    window.history.replaceState({ previousRoute: "/prior-path" }, "", "/here");
    button.addEventListener("click", () => router.back());

    middleClick(button);

    assert.deepEqual(
      openMock.mock.calls.map((call) => call.arguments),
      [["/prior-path", "_blank", "noopener"]],
    );
    assert.deepEqual(window.location.pathname, "/here");
  });

  it("should ignore auxclicks from non-middle buttons", () => {
    new Router();
    const clickHandler = mock.fn();
    button.addEventListener("click", clickHandler);

    middleClick(button, { button: 2 });

    assert.deepEqual(clickHandler.mock.callCount(), 0);
    assert.deepEqual(openMock.mock.callCount(), 0);
  });

  it("should leave middle clicks on anchors to native handling", () => {
    new Router();
    const anchor = document.createElement("a");
    anchor.href = "/native-link";
    button.appendChild(anchor);
    const clickHandler = mock.fn();
    button.addEventListener("click", clickHandler);

    middleClick(anchor);

    assert.deepEqual(clickHandler.mock.callCount(), 0);
    assert.deepEqual(openMock.mock.callCount(), 0);
  });

  it("should not re-dispatch when the auxclick default is prevented", () => {
    new Router();
    button.addEventListener("auxclick", (event) => event.preventDefault());
    const clickHandler = mock.fn();
    button.addEventListener("click", clickHandler);

    middleClick(button, { cancelable: true });

    assert.deepEqual(clickHandler.mock.callCount(), 0);
    assert.deepEqual(openMock.mock.callCount(), 0);
  });
});

describe("previousRoute", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should return null when history state has no previousRoute", () => {
    const router = new Router();
    window.history.replaceState(null, "", originalPath);
    try {
      assert.deepEqual(router.previousRoute, null);
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should return the previousRoute stored in history state", () => {
    const router = new Router();
    window.history.replaceState(
      { previousRoute: "/some/prior/path" },
      "",
      originalPath,
    );
    try {
      assert.deepEqual(router.previousRoute, "/some/prior/path");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should reflect the previousRoute after a go() call", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/prev-getter-test", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/origin-path");

    try {
      await router.go("/prev-getter-test");
      assert.deepEqual(router.previousRoute, "/origin-path");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

describe("back", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should call window.history.back when a previousRoute exists", async () => {
    const router = new Router();
    mountRouter(router);

    window.history.replaceState({ previousRoute: "/prior" }, "", originalPath);

    const originalBack = window.history.back.bind(window.history);
    let backCalled = false;
    window.history.back = () => {
      backCalled = true;
    };

    try {
      await router.back();
      assert(backCalled);
    } finally {
      window.history.back = originalBack;
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should navigate to / when no previousRoute exists", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/", () => Promise.resolve({}));

    window.history.replaceState(null, "", originalPath);

    const originalBack = window.history.back.bind(window.history);
    let backCalled = false;
    window.history.back = () => {
      backCalled = true;
    };

    try {
      await router.back();
      assert(!backCalled);
      assert.deepEqual(window.location.pathname, "/");
    } finally {
      window.history.back = originalBack;
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should navigate to fallbackRoute when no previousRoute exists", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/messages", () => Promise.resolve({}));

    window.history.replaceState(null, "", originalPath);

    try {
      await router.back({ fallbackRoute: "/messages" });
      assert.deepEqual(window.location.pathname, "/messages");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should ignore fallbackRoute when a previousRoute exists", async () => {
    const router = new Router();
    mountRouter(router);

    window.history.replaceState({ previousRoute: "/prior" }, "", originalPath);

    const originalBack = window.history.back.bind(window.history);
    let backCalled = false;
    window.history.back = () => {
      backCalled = true;
    };

    const pathBefore = window.location.pathname;
    try {
      await router.back({ fallbackRoute: "/messages" });
      assert(backCalled);
      assert.deepEqual(window.location.pathname, pathBefore);
    } finally {
      window.history.back = originalBack;
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should replace history when falling back, not push", async () => {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/messages", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/deep-link");
    const lengthBefore = window.history.length;

    try {
      await router.back({ fallbackRoute: "/messages" });
      assert.deepEqual(window.location.pathname, "/messages");
      assert.deepEqual(window.history.length, lengthBefore);
      assert.deepEqual(router.previousRoute, null);
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

describe("redirect routes", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  afterEach(() => {
    window.history.replaceState(originalState, "", originalPath);
  });

  function createRouter() {
    const router = new Router();
    mountRouter(router);
    router.addRedirects({
      "/old": () => "/new",
      "/old/:id": (params) => `/new/${params.id}`,
    });
    router.addRoute("/new", () => Promise.resolve({ name: "new" }));
    router.addRoute("/new/:id", () => Promise.resolve({ name: "newDetail" }));
    router.renderRoute(() => {});
    return router;
  }

  it("keeps redirects separate from routes", () => {
    const router = createRouter();
    assert.deepEqual(router.hasRoute("/old"), false);
    assert.deepEqual(router.matchRedirect("/old"), "/new");
    assert.deepEqual(router.matchRedirect("/old/123"), "/new/123");
    assert.deepEqual(router.matchRedirect("/unrelated"), null);
  });

  it("loads the target route and replaces the URL", async () => {
    const router = createRouter();
    await router.load("/old");
    assert.deepEqual(window.location.pathname, "/new");
    assert.deepEqual(router.$currentRoute.get().route, "/new");
  });

  it("passes route params to the redirect function", async () => {
    const router = createRouter();
    await router.load("/old/123");
    assert.deepEqual(window.location.pathname, "/new/123");
    assert.deepEqual(router.$currentRoute.get().params, { id: "123" });
  });

  it("preserves the query string across the redirect", async () => {
    const router = createRouter();
    await router.load("/old?foo=bar&baz=1");
    assert.deepEqual(window.location.pathname, "/new");
    assert.deepEqual(window.location.search, "?foo=bar&baz=1");
    assert.deepEqual(router.$currentRoute.get().route, "/new");
  });

  it("replaces the history entry instead of pushing", async () => {
    const router = createRouter();
    window.history.replaceState(null, "", "/old");
    const lengthBefore = window.history.length;
    await router.load("/old");
    assert.deepEqual(window.history.length, lengthBefore);
  });

  it("preserves the existing history state across the redirect", async () => {
    const router = createRouter();
    window.history.replaceState({ previousRoute: "/prior" }, "", "/old");
    await router.load("/old");
    assert.deepEqual(window.history.state?.previousRoute, "/prior");
  });
});

describe("route options", () => {
  it("stores options on the route and returns them from match", () => {
    const router = new Router();
    const options = { layoutOptions: { activeNavItem: "home" } };
    router.addRoute("/test", () => {}, options);
    assert.deepEqual(router.match("/test").options, options);
  });

  it("defaults options to an empty object", () => {
    const router = new Router();
    router.addRoute("/test", () => {});
    assert.deepEqual(router.match("/test").options, {});
  });

  it("returns notFound options for unmatched paths", () => {
    const router = new Router();
    router.setNotFoundView(() => {}, { layout: false });
    assert.deepEqual(router.match("/nope").options, { layout: false });
  });

  it("appends pages to the default container by default", async () => {
    const router = new Router();
    const { defaultContainer, bareContainer } = mountRouter(router);
    router.addRoute("/test", () => Promise.resolve({}));
    router.renderRoute(() => {});

    await router.load("/test");

    assert.deepEqual(router.currentPage.parentElement, defaultContainer);
    assert(!bareContainer.contains(router.currentPage));
  });

  it("passes the layout to renders of layout routes only", async () => {
    const router = new Router();
    const layout = new TestLayout();
    mountRouter(router, { layout });
    router.addRoute("/test", () => Promise.resolve({}));
    router.addRoute("/login", () => Promise.resolve({}), { layout: false });
    let receivedLayout;
    router.renderRoute(({ layout: renderLayout }) => {
      receivedLayout = renderLayout;
    });

    await router.load("/test");
    assert.deepEqual(receivedLayout, layout);

    await router.load("/login");
    assert.deepEqual(receivedLayout, null);
  });

  it("appends pages to the bare container when layout is false", async () => {
    const router = new Router();
    const { defaultContainer, bareContainer } = mountRouter(router);
    router.addRoute("/login", () => Promise.resolve({}), { layout: false });
    router.renderRoute(() => {});

    await router.load("/login");

    assert.deepEqual(router.currentPage.parentElement, bareContainer);
  });
});

describe("layout visibility", () => {
  function createRouterWithLayout() {
    const router = new Router();
    const layout = new TestLayout();
    const { layoutContainer } = mountRouter(router, { layout });
    const isLayoutHidden = () =>
      layoutContainer.classList.contains("layout-hidden");
    router.addRoute("/test", () => Promise.resolve({}));
    router.addRoute("/login", () => Promise.resolve({}), { layout: false });
    router.renderRoute(() => {});
    return { router, isLayoutHidden };
  }

  it("hides the layout before rendering a new bare page", async () => {
    const { router, isLayoutHidden } = createRouterWithLayout();
    let hiddenAtRenderTime = null;
    router.renderRoute(() => {
      hiddenAtRenderTime = isLayoutHidden();
    });

    await router.load("/login");
    assert.deepEqual(hiddenAtRenderTime, true);

    await router.load("/test");
    assert.deepEqual(hiddenAtRenderTime, false);
  });

  it("shows the layout before a cached page's restore handlers run", async () => {
    const { router, isLayoutHidden } = createRouterWithLayout();
    await router.load("/test");
    await router.load("/login");
    assert.deepEqual(isLayoutHidden(), true);

    // Views restore scroll synchronously in page-restore handlers, so the
    // layout must already be visible when the event fires
    let hiddenAtRestoreTime = null;
    const { el: testPage } = router.pages.get("/test");
    testPage.addEventListener("page-restore", () => {
      hiddenAtRestoreTime = isLayoutHidden();
    });

    await router.load("/test");

    assert.deepEqual(hiddenAtRestoreTime, false);
  });
});

describe("$currentRoute", () => {
  function createRouter() {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/user/:id", () => Promise.resolve({}), {
      layoutOptions: { activeNavItem: "profile" },
    });
    router.addRoute("/other", () => Promise.resolve({}));
    router.renderRoute(() => {});
    return router;
  }

  it("is set when loading a new page", async () => {
    const router = createRouter();

    await router.load("/user/123?tab=posts");

    assert.deepEqual(router.$currentRoute.get(), {
      path: "/user/123?tab=posts",
      route: "/user/:id",
      params: { id: "123" },
      options: { layoutOptions: { activeNavItem: "profile" } },
    });
  });

  it("is set when restoring a cached page", async () => {
    const router = createRouter();
    await router.load("/user/123");
    await router.load("/other");

    await router.load("/user/123");

    assert.deepEqual(router.$currentRoute.get().route, "/user/:id");
    assert.deepEqual(router.$currentRoute.get().params, { id: "123" });
  });
});

describe("scroll position persistence", () => {
  // JSDOM's window.scrollY is a read-only getter, so temporarily override it to
  // simulate the page being scrolled before we navigate away.
  function withScrollY(value, callback) {
    const original = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", {
      value,
      configurable: true,
    });
    return (async () => {
      try {
        return await callback();
      } finally {
        if (original) {
          Object.defineProperty(window, "scrollY", original);
        } else {
          delete window.scrollY;
        }
      }
    })();
  }

  function createRouter() {
    const router = new Router();
    mountRouter(router);
    router.addRoute("/a", () => Promise.resolve({}));
    router.addRoute("/b", () => Promise.resolve({}));
    router.renderRoute(() => {});
    return router;
  }

  it("saves the scroll position of the page being navigated away from", async () => {
    const router = createRouter();
    await router.load("/a");

    await withScrollY(250, () => router.load("/b"));

    assert.deepEqual(router.scrollStates.get("/a"), 250);
  });

  it("does not record a scroll position on the very first load", async () => {
    const router = createRouter();

    await withScrollY(250, () => router.load("/a"));

    assert.deepEqual(router.scrollStates.has("/a"), false);
  });

  it("restores the saved scroll position via the page-restore event", async () => {
    const router = createRouter();
    await router.load("/a");

    const pageA = router.pages.get("/a").el;
    let restoredScrollY = null;
    pageA.addEventListener("page-restore", (event) => {
      restoredScrollY = event.detail.scrollY;
    });

    await withScrollY(175, async () => {
      await router.load("/b"); // leaving /a saves 175 under /a
      await router.load("/a"); // returning to cached /a restores it
    });

    assert.deepEqual(restoredScrollY, 175);
  });
});
