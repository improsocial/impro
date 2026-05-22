import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals, mock, MockFetch } from "../../testHelpers.js";
import "/js/components/impro-icon.js";

const t = new TestSuite("ImproIcon");

const SAMPLE_SVG =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function okResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
  };
}

function notFoundResponse() {
  return {
    ok: false,
    status: 404,
    statusText: "Not Found",
    text: async () => "",
  };
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ImproIcon - set defaulting", (it) => {
  it("defaults set to majesticons when not specified", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    element.setAttribute("name", "default-set-icon");
    document.body.appendChild(element);
    await flush();

    assertEquals(
      fetch.calls[0].url,
      "/img/icons/majesticons/default-set-icon.svg",
    );
  });

  it("uses the provided set", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    element.setAttribute("set", "custom-set");
    element.setAttribute("name", "explicit-set-icon");
    document.body.appendChild(element);
    await flush();

    assertEquals(
      fetch.calls[0].url,
      "/img/icons/custom-set/explicit-set-icon.svg",
    );
  });
});

t.describe("ImproIcon - rendering", (it) => {
  it("injects the fetched SVG markup", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    element.setAttribute("name", "render-test");
    document.body.appendChild(element);
    await flush();

    const svg = element.querySelector("svg");
    assert(svg !== null);
    assertEquals(svg.getAttribute("viewBox"), "0 0 24 24");
  });

  it("renders nothing when name is empty", async () => {
    const fetch = new MockFetch();
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    document.body.appendChild(element);
    await flush();

    assertEquals(fetch.calls.length, 0);
    assertEquals(element.innerHTML, "");
  });

  it("swaps the icon when name changes", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/majesticons/swap-first.svg", async () =>
      okResponse('<svg id="first"></svg>'),
    );
    fetch.__intercept("/img/icons/majesticons/swap-second.svg", async () =>
      okResponse('<svg id="second"></svg>'),
    );
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    element.setAttribute("name", "swap-first");
    document.body.appendChild(element);
    await flush();
    assertEquals(element.querySelector("svg").id, "first");

    element.setAttribute("name", "swap-second");
    await flush();
    assertEquals(element.querySelector("svg").id, "second");
  });

  it("refetches when set changes", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/set-a/set-swap.svg", async () =>
      okResponse('<svg id="a"></svg>'),
    );
    fetch.__intercept("/img/icons/set-b/set-swap.svg", async () =>
      okResponse('<svg id="b"></svg>'),
    );
    globalThis.fetch = fetch;

    const element = document.createElement("impro-icon");
    element.setAttribute("set", "set-a");
    element.setAttribute("name", "set-swap");
    document.body.appendChild(element);
    await flush();
    assertEquals(element.querySelector("svg").id, "a");

    element.setAttribute("set", "set-b");
    await flush();
    assertEquals(element.querySelector("svg").id, "b");
  });
});

t.describe("ImproIcon - caching", (it) => {
  it("only fetches once when the same icon is rendered twice", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const first = document.createElement("impro-icon");
    first.setAttribute("name", "cache-shared");
    document.body.appendChild(first);

    const second = document.createElement("impro-icon");
    second.setAttribute("name", "cache-shared");
    document.body.appendChild(second);

    await flush();

    assertEquals(fetch.calls.length, 1);
    assert(first.querySelector("svg") !== null);
    assert(second.querySelector("svg") !== null);
  });
});

t.describe("ImproIcon - error handling", (it) => {
  it("warns and renders nothing when the fetch 404s; does not retry", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => notFoundResponse());
    globalThis.fetch = fetch;

    const originalWarn = console.warn;
    const warnMock = mock();
    console.warn = warnMock;

    try {
      const element = document.createElement("impro-icon");
      element.setAttribute("name", "missing-icon");
      document.body.appendChild(element);
      await flush();

      assertEquals(element.innerHTML, "");
      assertEquals(warnMock.calls.length, 1);

      const retry = document.createElement("impro-icon");
      retry.setAttribute("name", "missing-icon");
      document.body.appendChild(retry);
      await flush();

      assertEquals(fetch.calls.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});

await t.run();
