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
      window.history.replaceState(null, "", originalPath);
    }

    assertEquals(order[0], "navigate");
    assertEquals(order[1], "page-shown");
  });
});

await t.run();
