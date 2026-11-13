import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { Permissions } from "/js/plugins/pluginPermissions.js";

const publicHostArbitrary = fc.constantFrom(
  "example.com",
  "api.example.com",
  "EXAMPLE.com",
  "bsky.social",
  "a.b.c.example.org",
);

const loopbackHostArbitrary = fc.constantFrom(
  "localhost",
  "dev.localhost",
  "127.0.0.1",
  "127.5.6.7",
  "[::1]",
);

const baseHostArbitrary = fc.oneof(
  publicHostArbitrary.map((host) => ({ host, isLoopback: false })),
  loopbackHostArbitrary.map((host) => ({ host, isLoopback: true })),
);

const isIpHost = (host) => /^[\d.]+$|^\[/.test(host);

// How the requested host relates to the host named in the pattern.
function relatedHostArbitrary(baseHost) {
  const relations = [{ relation: "same", host: baseHost }];
  if (!isIpHost(baseHost)) {
    relations.push(
      { relation: "subdomain", host: `sub.${baseHost}` },
      { relation: "subdomain", host: `deep.sub.${baseHost}` },
      { relation: "other", host: `evil${baseHost}` },
      { relation: "other", host: `evil-${baseHost}` },
      { relation: "other", host: `${baseHost}.evil.net` },
      { relation: "other", host: `${baseHost}evil.net` },
    );
  }
  relations.push({ relation: "other", host: "unrelated.net" });
  return fc.constantFrom(...relations);
}

const portArbitrary = fc.constantFrom(null, 443, 80, 8443, 11434);

const patternPathArbitrary = fc.constantFrom(
  null,
  "/*",
  "/api/*",
  "/api",
  "/api/v1",
  "/api/v1/*",
);

const urlPathArbitrary = fc.constantFrom(
  "",
  "/",
  "/api",
  "/api/",
  "/api/v1",
  "/api/v1/users",
  "/apiv2",
  "/API/v1",
  "/other",
  "/api/../other",
  "/api/./v1",
  "/other/../api/v1",
);

const urlSuffixArbitrary = fc.constantFrom("", "?q=1", "#frag", "?next=/api/");

const userInfoArbitrary = fc.constantFrom("", "user@", "example.com@");

const caseArbitrary = fc
  .record({
    patternScheme: fc.constantFrom("https", "http"),
    urlScheme: fc.constantFrom("https", "http", "ftp", "ws"),
    base: baseHostArbitrary,
    isWildcard: fc.boolean(),
    patternPort: portArbitrary,
    urlPort: portArbitrary,
    patternPath: patternPathArbitrary,
    urlPath: urlPathArbitrary,
    urlSuffix: urlSuffixArbitrary,
    userInfo: userInfoArbitrary,
  })
  .chain((fields) =>
    relatedHostArbitrary(fields.base.host).map((urlHost) => ({
      ...fields,
      isWildcard: fields.isWildcard && !isIpHost(fields.base.host),
      urlHost,
    })),
  );

function buildPattern({
  patternScheme,
  base,
  isWildcard,
  patternPort,
  patternPath,
}) {
  const host = isWildcard ? `*.${base.host}` : base.host;
  const port = patternPort === null ? "" : `:${patternPort}`;
  return `${patternScheme}://${host}${port}${patternPath ?? ""}`;
}

function buildUrl({
  urlScheme,
  userInfo,
  urlHost,
  urlPort,
  urlPath,
  urlSuffix,
}) {
  const port = urlPort === null ? "" : `:${urlPort}`;
  return `${urlScheme}://${userInfo}${urlHost.host}${port}${urlPath}${urlSuffix}`;
}

const DEFAULT_PORTS = { https: 443, http: 80 };

function expectedToAllow(testCase) {
  const {
    patternScheme,
    urlScheme,
    base,
    isWildcard,
    patternPort,
    urlPort,
    patternPath,
    urlHost,
  } = testCase;
  if (urlScheme !== patternScheme) return false;
  if (urlScheme === "http" && !base.isLoopback) return false;
  const hostAllowed =
    urlHost.relation === "same" ||
    (isWildcard && urlHost.relation === "subdomain");
  if (!hostAllowed) return false;
  if (urlScheme === "http" && urlHost.relation !== "same") {
    // Only *.localhost keeps subdomains on loopback.
    if (!base.host.endsWith("localhost")) return false;
  }
  const effectiveUrlPort = urlPort ?? DEFAULT_PORTS[urlScheme];
  if (patternPort !== null && patternPort !== effectiveUrlPort) return false;
  const actualPath = new URL(buildUrl(testCase)).pathname;
  const pathPattern = patternPath ?? "/*";
  return pathPattern.endsWith("*")
    ? actualPath.startsWith(pathPattern.slice(0, -1))
    : actualPath === pathPattern;
}

const junkPatternArbitrary = fc.oneof(
  fc.string(),
  fc.constantFrom(
    "*",
    "https://*",
    "https://*/*",
    "https://*.*/*",
    "https://*.com/*",
    "https://",
    "://example.com",
    "example.com",
    "HTTPS://example.com/*",
    "https://exa*mple.com/*",
    "https://example.com:abc/*",
    "http://example.com/*",
    "file:///etc/passwd",
    "javascript://example.com/*",
  ),
);

const requestUrlArbitrary = fc.oneof(
  caseArbitrary.map(buildUrl),
  fc.webUrl({ validSchemes: ["http", "https", "ftp"] }),
  fc.string(),
);

function isLoopbackUrl(url) {
  const host = url.hostname;
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(host)
  );
}

describe("Permissions fetch matching properties", () => {
  beforeEach(() => {
    mock.method(console, "error", () => {});
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("allows a URL exactly when its scheme, host, port and path fit the pattern", () => {
    fc.assert(
      fc.property(caseArbitrary, (testCase) => {
        const permissions = Permissions.parse({
          fetch: [buildPattern(testCase)],
        });
        assert.deepEqual(
          permissions.allowsFetch(buildUrl(testCase)),
          expectedToAllow(testCase),
        );
      }),
      { numRuns: 2000 },
    );
  });

  it("never allows plaintext or non-http requests off loopback, whatever the patterns", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(junkPatternArbitrary, caseArbitrary.map(buildPattern)),
          {
            maxLength: 5,
          },
        ),
        requestUrlArbitrary,
        (patterns, url) => {
          const allowed = Permissions.parse({ fetch: patterns }).allowsFetch(
            url,
          );
          if (!allowed) return;
          const parsedUrl = new URL(url);
          assert(
            parsedUrl.protocol === "https:" ||
              (parsedUrl.protocol === "http:" && isLoopbackUrl(parsedUrl)),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("allows nothing when every pattern is malformed or host-wildcarded", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "*",
          "https://*",
          "https://*/*",
          "https://*.*/*",
          "https://",
          "example.com",
          "HTTPS://example.com/*",
          "https://exa*mple.com/*",
          "https://example.com:abc/*",
          "http://example.com/*",
        ),
        caseArbitrary.map(buildUrl),
        (pattern, url) => {
          assert.deepEqual(
            Permissions.parse({ fetch: [pattern] }).allowsFetch(url),
            false,
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it("grants access to a URL through its own normalized origin", () => {
    fc.assert(
      fc.property(caseArbitrary, (testCase) => {
        const url = buildUrl(testCase);
        const origin = Permissions.normalizeFetchOrigin(url);
        const parsedUrl = new URL(url);
        const isFetchable =
          !testCase.userInfo &&
          (parsedUrl.protocol === "https:" ||
            (parsedUrl.protocol === "http:" && isLoopbackUrl(parsedUrl)));
        if (!isFetchable) {
          assert.deepEqual(origin, null);
          return;
        }
        const permissions = Permissions.parse({}).withFetchOrigins([origin]);
        assert(permissions.allowsFetch(url));
        const otherHostUrl = buildUrl({
          ...testCase,
          urlScheme: "https",
          userInfo: "",
          urlHost: { host: "elsewhere.test" },
        });
        assert.deepEqual(permissions.allowsFetch(otherHostUrl), false);
      }),
      { numRuns: 1000 },
    );
  });
});
