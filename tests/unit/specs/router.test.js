import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
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

await t.run();
