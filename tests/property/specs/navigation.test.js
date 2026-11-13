import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  validateReturnToParam,
  getPermalinkForPost,
  getPermalinkForStarterPack,
  linkToFeed,
  linkToList,
  linkToStarterPack,
} from "/js/navigation.js";
import { parseRecordLink } from "/js/embedHelpers.js";
import { INVALID_HANDLE } from "/js/dataHelpers.js";

const redirectFragmentArbitrary = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.constantFrom(
      "/",
      "//",
      "/../",
      "/./",
      "\\",
      "\t",
      "\n",
      "\r",
      " ",
      "\u0000",
      "evil.com",
      "@",
      ":",
      "https:",
      "javascript:",
      "?",
      "#",
      "%2f",
      "%5c",
      "..",
      ".",
      "home",
    ),
  },
  { weight: 1, arbitrary: fc.string({ unit: "binary", maxLength: 3 }) },
);

const returnToArbitrary = fc
  .array(redirectFragmentArbitrary, { maxLength: 8 })
  .map((fragments) => fragments.join(""));

const pathSegmentArbitrary = fc.stringMatching(/^[a-z0-9]{1,8}$/);

const didArbitrary = fc
  .stringMatching(/^[a-z2-7]{24}$/)
  .map((identifier) => `did:plc:${identifier}`);

const profileArbitrary = fc.record({
  did: didArbitrary,
  handle: fc.oneof(
    pathSegmentArbitrary.map((label) => `${label}.bsky.social`),
    fc.constant(INVALID_HANDLE),
  ),
});

const rkeyArbitrary = fc.oneof(
  fc.stringMatching(/^[a-z2-7]{13}$/),
  fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._~:-]{0,14}$/),
);

function expectedIdentifier(profile) {
  return profile.handle === INVALID_HANDLE ? profile.did : profile.handle;
}

describe("validateReturnToParam properties", () => {
  it("only ever returns a path on the app's own origin", () => {
    fc.assert(
      fc.property(returnToArbitrary, (raw) => {
        const result = validateReturnToParam(raw);
        if (result === null) return;
        assert(result.startsWith("/"));
        for (const origin of [window.location.origin, "https://impro.social"]) {
          assert.deepEqual(new URL(result, origin).origin, origin);
        }
      }),
      { numRuns: 20000 },
    );
  });

  it("returns ordinary in-app paths unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(pathSegmentArbitrary, { minLength: 1, maxLength: 4 }),
        fc.constantFrom("", "?tab=posts", "#top", "?q=a%20b&x=1#frag"),
        (segments, suffix) => {
          const path = `/${segments.join("/")}${suffix}`;
          assert.deepEqual(validateReturnToParam(path), path);
        },
      ),
    );
  });
});

describe("record link properties", () => {
  it("parses a post permalink back to its author and rkey", () => {
    fc.assert(
      fc.property(profileArbitrary, rkeyArbitrary, (author, rkey) => {
        const post = {
          uri: `at://${author.did}/app.bsky.feed.post/${rkey}`,
          author,
        };
        assert.deepEqual(parseRecordLink(getPermalinkForPost(post)), {
          collection: "app.bsky.feed.post",
          didOrHandle: expectedIdentifier(author),
          rkey,
        });
      }),
      { numRuns: 300 },
    );
  });

  it("parses feed, list and starter pack links back to their creator and rkey", () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        rkeyArbitrary,
        fc.constantFrom(
          {
            collection: "app.bsky.feed.generator",
            build: (record) => `https://bsky.app${linkToFeed(record)}`,
          },
          {
            collection: "app.bsky.graph.list",
            build: (record) => `https://bsky.app${linkToList(record)}`,
          },
          {
            collection: "app.bsky.graph.starterpack",
            build: (record) => `https://bsky.app${linkToStarterPack(record)}`,
          },
          {
            collection: "app.bsky.graph.starterpack",
            build: getPermalinkForStarterPack,
          },
        ),
        (creator, rkey, { collection, build }) => {
          const record = {
            uri: `at://${creator.did}/${collection}/${rkey}`,
            creator,
          };
          assert.deepEqual(parseRecordLink(build(record)), {
            collection,
            didOrHandle: expectedIdentifier(creator),
            rkey,
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});
