import { TestSuite } from "../testSuite.js";
import { assert, assertEquals, mock } from "../testHelpers.js";
import { Router } from "/js/router.js";

const t = new TestSuite("Router");

t.describe("constructor and initialization", (it) => {
  it("should initialize with empty routes", () => {
    const router = new Router();
    assertEquals(Object.keys(router.routes).length, 0);
  });

  it("should initialize with default notFoundView", () => {
    const router = new Router();
    assert(typeof router.notFoundView === "function");
  });

  it("should initialize with null container", () => {
    const router = new Router();
    assertEquals(router.container, null);
  });
});

t.describe("addRoute", (it) => {
  it("should add a route with viewGetter", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/test", viewGetter);
    assert(router.routes["/test"]);
    assertEquals(router.routes["/test"].viewGetter, viewGetter);
  });

  it("should add multiple routes", () => {
    const router = new Router();
    router.addRoute("/path1", () => {});
    router.addRoute("/path2", () => {});
    assertEquals(Object.keys(router.routes).length, 2);
  });
});

t.describe("setNotFoundView", (it) => {
  it("should set notFoundView function", () => {
    const router = new Router();
    const notFoundView = () => "404";
    router.setNotFoundView(notFoundView);
    assertEquals(router.notFoundView, notFoundView);
  });
});

t.describe("mount", (it) => {
  it("should set container", () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    assertEquals(router.container, container);
  });

  it("should clear pre-existing container contents", () => {
    const router = new Router();
    const container = document.createElement("div");
    container.innerHTML = "<p>stale ssr/loading markup</p>";
    router.mount(container);
    assertEquals(container.innerHTML, "");
  });
});

t.describe("matchPath (static method)", (it) => {
  it("should match exact path", () => {
    const params = Router.matchPath("/test", "/test");
    assertEquals(params, {});
  });

  it("should return null for non-matching paths", () => {
    const params = Router.matchPath("/test", "/other");
    assertEquals(params, null);
  });

  it("should extract single parameter", () => {
    const params = Router.matchPath("/user/john", "/user/:name");
    assertEquals(params, { name: "john" });
  });

  it("should extract multiple parameters", () => {
    const params = Router.matchPath(
      "/profile/gracekind.net/post/3lykznxiikc2k",
      "/profile/:handle/post/:rkey",
    );
    assertEquals(params, { handle: "gracekind.net", rkey: "3lykznxiikc2k" });
  });

  it("should return null for different path lengths", () => {
    const params = Router.matchPath("/test/extra", "/test");
    assertEquals(params, null);
  });

  it("should handle empty path segments", () => {
    const params = Router.matchPath("/", "/");
    assertEquals(params, {});
  });

  it("should match path with parameter at start", () => {
    const params = Router.matchPath("/john/profile", "/:name/profile");
    assertEquals(params, { name: "john" });
  });

  it("should decode percent-encoded path parameters", () => {
    const params = Router.matchPath("/hashtag/hello%20world", "/hashtag/:tag");
    assertEquals(params, { tag: "hello world" });
  });

  it("should decode encoded slashes in parameters", () => {
    const params = Router.matchPath(
      "/profile/alice%2Fevil/post/abc123",
      "/profile/:handle/post/:rkey",
    );
    assertEquals(params, { handle: "alice/evil", rkey: "abc123" });
  });

  it("should preserve colons in DID parameters", () => {
    const params = Router.matchPath(
      "/profile/did:plc:abc123/post/key456",
      "/profile/:handle/post/:rkey",
    );
    assertEquals(params, { handle: "did:plc:abc123", rkey: "key456" });
  });
});

t.describe("match", (it) => {
  it("should match existing route", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/test", viewGetter);
    const result = router.match("/test");
    assertEquals(result.route, "/test");
    assertEquals(result.viewGetter, viewGetter);
    assertEquals(result.params, {});
  });

  it("should match route with parameters", () => {
    const router = new Router();
    const viewGetter = () => "view";
    router.addRoute("/user/:id", viewGetter);
    const result = router.match("/user/123");
    assertEquals(result.route, "/user/:id");
    assertEquals(result.params, { id: "123" });
  });

  it("should return notFoundView for non-matching path", () => {
    const router = new Router();
    const notFoundView = () => "404";
    router.setNotFoundView(notFoundView);
    const result = router.match("/nonexistent");
    assertEquals(result.route, null);
    assertEquals(result.viewGetter, notFoundView);
    assertEquals(result.params, {});
  });

  it("should match first matching route", () => {
    const router = new Router();
    const view1 = () => "view1";
    const view2 = () => "view2";
    router.addRoute("/user/:id", view1);
    router.addRoute("/user/:name", view2);
    const result = router.match("/user/123");
    assertEquals(result.viewGetter, view1);
  });
});

t.describe("renderRoute", (it) => {
  it("should set renderFunc", () => {
    const router = new Router();
    const renderFunc = () => {};
    router.renderRoute(renderFunc);
    assertEquals(router.renderFunc, renderFunc);
  });
});

t.describe("popstate", (it) => {
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
    const container = document.createElement("div");
    router.mount(container);

    const listener = mock();
    router.on("navigate", listener);

    await popstateHandler(new Event("popstate"));

    assertEquals(listener.calls.length, 1);
  });

  it("should emit navigate before loading the new page", async () => {
    const { router, popstateHandler } = createRouterWithPopstateHandler();
    const container = document.createElement("div");
    router.mount(container);

    const order = [];
    router.on("navigate", () => order.push("navigate"));
    router.on("page-shown", () => order.push("page-shown"));

    await popstateHandler(new Event("popstate"));

    assertEquals(order[0], "navigate");
  });

  it("restores a query-bearing page from cache on back navigation", async () => {
    const originalPath =
      window.location.pathname + window.location.search + window.location.hash;
    const originalState = window.history.state;
    const { router, popstateHandler } = createRouterWithPopstateHandler();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/search", () => Promise.resolve({}));
    router.addRoute("/other", () => Promise.resolve({}));
    router.renderRoute(() => {});

    try {
      await router.load("/search?q=alice");
      const searchPage = router.pages.get("/search?q=alice");
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

t.describe("load", (it) => {
  it("should load route and render view", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);

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
    assertEquals(renderArgs.view, view);
    assertEquals(renderArgs.params, {});
    assert(renderArgs.container);
    assert(container.contains(renderArgs.container));
  });

  it("should pass route parameters to renderFunc", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);

    router.addRoute("/user/:id", () => Promise.resolve({}));

    let receivedParams = null;
    router.renderRoute((args) => {
      receivedParams = args.params;
    });

    await router.load("/user/123");

    assertEquals(receivedParams, { id: "123" });
  });
});

t.describe("go", (it) => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should emit navigate event before loading the new page", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/go-test", () => Promise.resolve({}));

    const order = [];
    router.on("navigate", () => order.push("navigate"));
    router.on("page-shown", () => order.push("page-shown"));

    try {
      await router.go("/go-test");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }

    assertEquals(order[0], "navigate");
    assertEquals(order[1], "page-shown");
  });

  it("should store the previous route in history state", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/go-prev-test", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/starting-path");

    try {
      await router.go("/go-prev-test");
      assertEquals(window.history.state?.previousRoute, "/starting-path");
      assertEquals(window.location.pathname, "/go-prev-test");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

t.describe("modifier-click navigation", (it, { beforeEach, afterEach }) => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;
  const originalOpen = window.open;
  let openMock;
  let button;

  beforeEach(() => {
    openMock = mock();
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
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/meta-test", () => Promise.resolve({}));

    let navigated = false;
    router.on("navigate", () => (navigated = true));
    window.history.replaceState(null, "", "/starting-path");
    button.addEventListener("click", () => router.go("/meta-test"));

    click({ metaKey: true });

    assertEquals(openMock.calls.length, 1);
    assertEquals(openMock.calls[0], ["/meta-test", "_blank"]);
    assertEquals(navigated, false);
    assertEquals(window.location.pathname, "/starting-path");
  });

  it("should open in a new tab on ctrl+click", () => {
    const router = new Router();
    button.addEventListener("click", () => router.go("/ctrl-test"));

    click({ ctrlKey: true });

    assertEquals(openMock.calls, [["/ctrl-test", "_blank"]]);
  });

  it("should navigate normally on unmodified click", () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/plain-test", () => Promise.resolve({}));
    button.addEventListener("click", () => router.go("/plain-test"));

    click();

    assertEquals(openMock.calls.length, 0);
    assertEquals(window.location.pathname, "/plain-test");
  });

  it("should open in a new tab on cmd+Enter", () => {
    const router = new Router();
    button.addEventListener("keydown", () => router.go("/enter-test"));

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", metaKey: true }),
    );

    assertEquals(openMock.calls, [["/enter-test", "_blank"]]);
  });

  it("should navigate normally when metaKey is held on a non-Enter key", () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/keyboard-test", () => Promise.resolve({}));
    button.addEventListener("keydown", () => router.go("/keyboard-test"));

    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );

    assertEquals(openMock.calls.length, 0);
    assertEquals(window.location.pathname, "/keyboard-test");
  });

  it("should open the previous route in a new tab on cmd+click of back", () => {
    const router = new Router();
    window.history.replaceState({ previousRoute: "/prior-path" }, "", "/here");
    button.addEventListener("click", () => router.back());

    click({ metaKey: true });

    assertEquals(openMock.calls, [["/prior-path", "_blank"]]);
    assertEquals(window.location.pathname, "/here");
  });

  it("should open home in a new tab on cmd+click of back without history", () => {
    const router = new Router();
    window.history.replaceState(null, "", "/here");
    button.addEventListener("click", () => router.back());

    click({ metaKey: true });

    assertEquals(openMock.calls, [["/", "_blank"]]);
  });
});

t.describe("middle-click navigation", (it, { beforeEach, afterEach }) => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;
  const originalOpen = window.open;
  let openMock;
  let button;

  beforeEach(() => {
    openMock = mock();
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
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/middle-test", () => Promise.resolve({}));

    let navigated = false;
    router.on("navigate", () => (navigated = true));
    window.history.replaceState(null, "", "/starting-path");
    button.addEventListener("click", () => router.go("/middle-test"));

    middleClick(button);

    assertEquals(openMock.calls, [["/middle-test", "_blank"]]);
    assertEquals(navigated, false);
    assertEquals(window.location.pathname, "/starting-path");
  });

  it("should open the previous route in a new tab on middle click of back", () => {
    const router = new Router();
    window.history.replaceState({ previousRoute: "/prior-path" }, "", "/here");
    button.addEventListener("click", () => router.back());

    middleClick(button);

    assertEquals(openMock.calls, [["/prior-path", "_blank"]]);
    assertEquals(window.location.pathname, "/here");
  });

  it("should ignore auxclicks from non-middle buttons", () => {
    new Router();
    const clickHandler = mock();
    button.addEventListener("click", clickHandler);

    middleClick(button, { button: 2 });

    assertEquals(clickHandler.calls.length, 0);
    assertEquals(openMock.calls.length, 0);
  });

  it("should leave middle clicks on anchors to native handling", () => {
    new Router();
    const anchor = document.createElement("a");
    anchor.href = "/native-link";
    button.appendChild(anchor);
    const clickHandler = mock();
    button.addEventListener("click", clickHandler);

    middleClick(anchor);

    assertEquals(clickHandler.calls.length, 0);
    assertEquals(openMock.calls.length, 0);
  });

  it("should not re-dispatch when the auxclick default is prevented", () => {
    new Router();
    button.addEventListener("auxclick", (event) => event.preventDefault());
    const clickHandler = mock();
    button.addEventListener("click", clickHandler);

    middleClick(button, { cancelable: true });

    assertEquals(clickHandler.calls.length, 0);
    assertEquals(openMock.calls.length, 0);
  });
});

t.describe("previousRoute", (it) => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should return null when history state has no previousRoute", () => {
    const router = new Router();
    window.history.replaceState(null, "", originalPath);
    try {
      assertEquals(router.previousRoute, null);
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
      assertEquals(router.previousRoute, "/some/prior/path");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });

  it("should reflect the previousRoute after a go() call", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/prev-getter-test", () => Promise.resolve({}));

    window.history.replaceState(null, "", "/origin-path");

    try {
      await router.go("/prev-getter-test");
      assertEquals(router.previousRoute, "/origin-path");
    } finally {
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

t.describe("back", (it) => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;
  const originalState = window.history.state;

  it("should call window.history.back when a previousRoute exists", async () => {
    const router = new Router();
    const container = document.createElement("div");
    router.mount(container);

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
    const container = document.createElement("div");
    router.mount(container);
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
      assertEquals(window.location.pathname, "/");
    } finally {
      window.history.back = originalBack;
      window.history.replaceState(originalState, "", originalPath);
    }
  });
});

t.describe("scroll position persistence", (it) => {
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
    const container = document.createElement("div");
    router.mount(container);
    router.addRoute("/a", () => Promise.resolve({}));
    router.addRoute("/b", () => Promise.resolve({}));
    router.renderRoute(() => {});
    return router;
  }

  it("saves the scroll position of the page being navigated away from", async () => {
    const router = createRouter();
    await router.load("/a");

    await withScrollY(250, () => router.load("/b"));

    assertEquals(router.scrollStates.get("/a"), 250);
  });

  it("does not record a scroll position on the very first load", async () => {
    const router = createRouter();

    await withScrollY(250, () => router.load("/a"));

    assertEquals(router.scrollStates.has("/a"), false);
  });

  it("restores the saved scroll position via the page-restore event", async () => {
    const router = createRouter();
    await router.load("/a");

    const pageA = router.pages.get("/a");
    let restoredScrollY = null;
    pageA.addEventListener("page-restore", (event) => {
      restoredScrollY = event.detail.scrollY;
    });

    await withScrollY(175, async () => {
      await router.load("/b"); // leaving /a saves 175 under /a
      await router.load("/a"); // returning to cached /a restores it
    });

    assertEquals(restoredScrollY, 175);
  });
});

await t.run();
