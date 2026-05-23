import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals, mock, MockFetch } from "../../testHelpers.js";
import "/js/components/plugin-icon.js";

const t = new TestSuite("PluginIcon");

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
  customElements.get("plugin-icon").cache = new Map();
});

t.describe("PluginIcon - iconset resolution", (it) => {
  it("resolves an icon from the majesticons set", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("plugin-icon");
    element.setAttribute("icon", "bell");
    document.body.appendChild(element);
    await flush();

    assertEquals(fetch.calls[0].url, "/img/icons/majesticons/bell.svg");
  });

  it("resolves an icon from the custom set", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("plugin-icon");
    element.setAttribute("icon", "verified-check");
    document.body.appendChild(element);
    await flush();

    assertEquals(fetch.calls[0].url, "/img/icons/custom/verified-check.svg");
  });

  it("warns and renders nothing for an unknown icon", async () => {
    const fetch = new MockFetch();
    globalThis.fetch = fetch;

    const originalWarn = console.warn;
    const warnMock = mock();
    console.warn = warnMock;

    try {
      const element = document.createElement("plugin-icon");
      element.setAttribute("icon", "not-a-real-icon");
      document.body.appendChild(element);
      await flush();

      assertEquals(fetch.calls.length, 0);
      assertEquals(element.innerHTML, "");
      assertEquals(warnMock.calls.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});

t.describe("PluginIcon - rendering", (it) => {
  it("injects the fetched SVG markup", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const element = document.createElement("plugin-icon");
    element.setAttribute("icon", "cake");
    document.body.appendChild(element);
    await flush();

    const svg = element.querySelector("svg");
    assert(svg !== null);
    assertEquals(svg.getAttribute("viewBox"), "0 0 24 24");
  });

  it("renders nothing when icon is empty", async () => {
    const fetch = new MockFetch();
    globalThis.fetch = fetch;

    const element = document.createElement("plugin-icon");
    document.body.appendChild(element);
    await flush();

    assertEquals(fetch.calls.length, 0);
    assertEquals(element.innerHTML, "");
  });

  it("swaps the icon when icon changes", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/majesticons/bus.svg", async () =>
      okResponse('<svg id="first"></svg>'),
    );
    fetch.__intercept("/img/icons/majesticons/car.svg", async () =>
      okResponse('<svg id="second"></svg>'),
    );
    globalThis.fetch = fetch;

    const element = document.createElement("plugin-icon");
    element.setAttribute("icon", "bus");
    document.body.appendChild(element);
    await flush();
    assertEquals(element.querySelector("svg").id, "first");

    element.setAttribute("icon", "car");
    await flush();
    assertEquals(element.querySelector("svg").id, "second");
  });
});

t.describe("PluginIcon - caching", (it) => {
  it("only fetches once when the same icon is rendered twice", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => okResponse(SAMPLE_SVG));
    globalThis.fetch = fetch;

    const first = document.createElement("plugin-icon");
    first.setAttribute("icon", "chat");
    document.body.appendChild(first);

    const second = document.createElement("plugin-icon");
    second.setAttribute("icon", "chat");
    document.body.appendChild(second);

    await flush();

    assertEquals(fetch.calls.length, 1);
    assert(first.querySelector("svg") !== null);
    assert(second.querySelector("svg") !== null);
  });
});

t.describe("PluginIcon - error handling", (it) => {
  it("warns and renders nothing when the fetch 404s; does not retry", async () => {
    const fetch = new MockFetch();
    fetch.__intercept("/img/icons/", async () => notFoundResponse());
    globalThis.fetch = fetch;

    const originalWarn = console.warn;
    const warnMock = mock();
    console.warn = warnMock;

    try {
      const element = document.createElement("plugin-icon");
      element.setAttribute("icon", "moon");
      document.body.appendChild(element);
      await flush();

      assertEquals(element.innerHTML, "");
      assertEquals(warnMock.calls.length, 1);

      const retry = document.createElement("plugin-icon");
      retry.setAttribute("icon", "moon");
      document.body.appendChild(retry);
      await flush();

      assertEquals(fetch.calls.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});

await t.run();
