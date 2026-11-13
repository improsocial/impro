import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  isAllowedLiveHost,
  parseYouTubeVideoFromUrl,
  getInviteCodeFromUrl,
  normalizeThreadgateAllowSettings,
  buildThreadgateAllowFromNormalized,
  parseUri,
  buildUri,
} from "/js/dataHelpers.js";
import { LIVE_ALLOWED_SERVICES, IN_APP_LINK_DOMAINS } from "/js/config.js";

const pathArbitrary = fc.constantFrom("", "/", "/channel", "/a/b?c=d#e");

// Hosts that merely contain or resemble `domain` without being it.
function lookalikeHosts(domain) {
  return [
    `evil${domain}`,
    `evil-${domain}`,
    `${domain}.evil.net`,
    `${domain}evil.net`,
    `user@evil.net`,
    `${domain}@evil.net`,
    `${domain}:pass@evil.net`,
    `evil.net/${domain}`,
    `evil.net?${domain}`,
    `evil.net#${domain}`,
    `evil.net\\@${domain}`.replace("\\@", "/@"),
  ];
}

const liveDomainArbitrary = fc.constantFrom(
  ...LIVE_ALLOWED_SERVICES.map((service) => service.domain),
);

const inAppDomainArbitrary = fc.constantFrom(...IN_APP_LINK_DOMAINS);

const videoIdArbitrary = fc.stringMatching(/^[A-Za-z0-9_-]{6,11}$/);

const startTimeArbitrary = fc.oneof(
  fc.constant({ seconds: 0, param: null }),
  fc
    .integer({ min: 1, max: 20000 })
    .map((seconds) => ({ seconds, param: String(seconds) })),
  fc
    .integer({ min: 1, max: 20000 })
    .map((seconds) => ({ seconds, param: `${seconds}s` })),
  fc
    .tuple(
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 1, max: 59 }),
    )
    .map(([hours, minutes, seconds]) => ({
      seconds: hours * 3600 + minutes * 60 + seconds,
      param: `${hours}h${minutes}m${seconds}s`,
    })),
);

const youTubeUrlArbitrary = fc
  .record({
    videoId: videoIdArbitrary,
    startTime: startTimeArbitrary,
    form: fc.constantFrom("watch", "short-link", "shorts", "live"),
    hostname: fc.constantFrom(
      "www.youtube.com",
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
    ),
  })
  .map(({ videoId, startTime, form, hostname }) => {
    const params = new URLSearchParams();
    let base = `https://${hostname}/${form}/${videoId}`;
    if (form === "watch") {
      base = `https://${hostname}/watch`;
      params.set("v", videoId);
    } else if (form === "short-link") {
      base = `https://youtu.be/${videoId}`;
    }
    if (startTime.param !== null) params.set("t", startTime.param);
    const query = params.toString();
    return {
      url: query ? `${base}?${query}` : base,
      expected: {
        videoId,
        startTime: startTime.seconds,
        isShort: form === "shorts",
      },
    };
  });

const threadgateRuleArbitrary = fc.oneof(
  fc.constant({ $type: "app.bsky.feed.threadgate#mentionRule" }),
  fc.constant({ $type: "app.bsky.feed.threadgate#followerRule" }),
  fc.constant({ $type: "app.bsky.feed.threadgate#followingRule" }),
  fc.stringMatching(/^[a-z2-7]{13}$/).map((rkey) => ({
    $type: "app.bsky.feed.threadgate#listRule",
    list: `at://did:plc:abc/app.bsky.graph.list/${rkey}`,
  })),
  fc.record({
    $type: fc.constantFrom("app.bsky.feed.threadgate#futureRule", "x.y#z"),
    extra: fc.jsonValue(),
  }),
);

const uriPartArbitrary = fc.stringMatching(/^[a-zA-Z0-9._:~-]{1,20}$/);

describe("isAllowedLiveHost properties", () => {
  it("accepts an allowed service and its subdomains over http(s)", () => {
    fc.assert(
      fc.property(
        liveDomainArbitrary,
        fc.constantFrom("", "www.", "a.b.", "WWW."),
        fc.constantFrom("https", "http", "HTTPS"),
        pathArbitrary,
        (domain, subdomain, scheme, path) => {
          assert(isAllowedLiveHost(`${scheme}://${subdomain}${domain}${path}`));
        },
      ),
    );
  });

  it("rejects lookalike hosts", () => {
    fc.assert(
      fc.property(
        liveDomainArbitrary.chain((domain) =>
          fc.constantFrom(...lookalikeHosts(domain)),
        ),
        pathArbitrary,
        (host, path) => {
          assert.deepEqual(isAllowedLiveHost(`https://${host}${path}`), false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("rejects non-http schemes even on an allowed host", () => {
    fc.assert(
      fc.property(
        liveDomainArbitrary,
        fc.constantFrom(
          "javascript",
          "data",
          "ftp",
          "file",
          "blob",
          "vbscript",
        ),
        fc.constantFrom("", "/%0aalert(1)", "/x"),
        (domain, scheme, path) => {
          assert.deepEqual(
            isAllowedLiveHost(`${scheme}://${domain}${path}`),
            false,
          );
        },
      ),
    );
  });
});

describe("parseYouTubeVideoFromUrl properties", () => {
  it("recovers the video id, start time and short flag from any link form", () => {
    fc.assert(
      fc.property(youTubeUrlArbitrary, ({ url, expected }) => {
        assert.deepEqual(parseYouTubeVideoFromUrl(url), expected);
      }),
      { numRuns: 500 },
    );
  });

  it("rejects lookalike hosts", () => {
    fc.assert(
      fc.property(
        fc
          .constantFrom("youtube.com", "www.youtube.com", "youtu.be")
          .chain((domain) => fc.constantFrom(...lookalikeHosts(domain))),
        videoIdArbitrary,
        (host, videoId) => {
          for (const url of [
            `https://${host}/watch?v=${videoId}`,
            `https://${host}/${videoId}`,
            `https://${host}/shorts/${videoId}`,
          ]) {
            assert.deepEqual(parseYouTubeVideoFromUrl(url), null);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("getInviteCodeFromUrl properties", () => {
  const codeArbitrary = fc.stringMatching(/^[a-zA-Z0-9]{7,10}$/);

  it("recovers the code from in-app chat invite links", () => {
    fc.assert(
      fc.property(codeArbitrary, inAppDomainArbitrary, (code, domain) => {
        assert.deepEqual(
          getInviteCodeFromUrl(`https://${domain}/chat/${code}`),
          code,
        );
        assert.deepEqual(getInviteCodeFromUrl(`/chat/${code}`), code);
      }),
    );
  });

  it("rejects lookalike hosts", () => {
    fc.assert(
      fc.property(
        codeArbitrary,
        inAppDomainArbitrary.chain((domain) =>
          fc.constantFrom(...lookalikeHosts(domain)),
        ),
        (code, host) => {
          assert.deepEqual(
            getInviteCodeFromUrl(`https://${host}/chat/${code}`),
            null,
          );
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("threadgate settings properties", () => {
  it("round-trips any allow list through the normalized form", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.array(threadgateRuleArbitrary, { maxLength: 5 }),
        ),
        (allow) => {
          assert.deepEqual(
            buildThreadgateAllowFromNormalized(
              normalizeThreadgateAllowSettings(allow),
            ),
            allow,
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("at-uri properties", () => {
  it("parseUri inverts buildUri", () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            repo: uriPartArbitrary,
            collection: uriPartArbitrary,
            rkey: uriPartArbitrary,
          },
          { noNullPrototype: true },
        ),
        (parts) => {
          assert.deepEqual(parseUri(buildUri(parts)), parts);
        },
      ),
    );
  });
});
