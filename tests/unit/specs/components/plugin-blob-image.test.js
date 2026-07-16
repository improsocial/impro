import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/plugin-blob-image.js";

describe("plugin-blob-image", () => {
  const VALID_CID =
    "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
  let didCounter = 0;

  function uniqueDid() {
    didCounter++;
    return `did:plc:test${didCounter.toString().padStart(6, "0")}xxxxxxx`;
  }

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function makeElement({ did, cid, alt, cdnPrefix }) {
    const element = document.createElement("plugin-blob-image");
    if (did !== undefined) element.setAttribute("did", did);
    if (cid !== undefined) element.setAttribute("cid", cid);
    if (alt !== undefined) element.setAttribute("alt", alt);
    if (cdnPrefix !== undefined) element.setAttribute("cdn-prefix", cdnPrefix);
    document.body.appendChild(element);
    return element;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("input validation", () => {
    it("renders the alt fallback when did is missing", async () => {
      const element = makeElement({
        cid: VALID_CID,
        alt: ":blobcat:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();
      assert(element.querySelector("img") === null);
      const fallback = element.querySelector(".blob-image-fallback");
      assert(fallback !== null);
      assert.deepEqual(fallback.textContent, ":blobcat:");
    });

    it("renders the alt fallback when cid is malformed", async () => {
      const element = makeElement({
        did: uniqueDid(),
        cid: "not-a-cid",
        alt: ":x:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();
      assert(element.querySelector("img") === null);
      assert(element.querySelector(".blob-image-fallback") !== null);
    });

    it("renders the alt fallback for a bogus DID method", async () => {
      const element = makeElement({
        did: "did:evil:x",
        cid: VALID_CID,
        alt: ":x:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();
      assert(element.querySelector("img") === null);
      assert(element.querySelector(".blob-image-fallback") !== null);
    });

    it("falls back when cdn-prefix is missing", async () => {
      const element = makeElement({
        did: uniqueDid(),
        cid: VALID_CID,
        alt: ":x:",
      });
      await flush();
      assert(element.querySelector("img") === null);
      assert(element.querySelector(".blob-image-fallback") !== null);
    });

    it("falls back when cdn-prefix is not allowlisted", async () => {
      const element = makeElement({
        did: uniqueDid(),
        cid: VALID_CID,
        alt: ":x:",
        cdnPrefix: "../secrets",
      });
      await flush();
      assert(element.querySelector("img") === null);
      assert(element.querySelector(".blob-image-fallback") !== null);
    });
  });

  describe("URL construction", () => {
    it("builds a bsky CDN URL from did/cid/cdn-prefix", async () => {
      const did = uniqueDid();
      const element = makeElement({
        did,
        cid: VALID_CID,
        alt: "avatar",
        cdnPrefix: "avatar_thumbnail",
      });
      await flush();
      const img = element.querySelector("img");
      assert(img !== null);
      assert.deepEqual(
        img.getAttribute("src"),
        `https://cdn.bsky.app/img/avatar_thumbnail/plain/${did}/${VALID_CID}@jpeg`,
      );
      assert.deepEqual(img.getAttribute("alt"), "avatar");
    });
  });

  describe("error handling", () => {
    it("shows fallback on image error", async () => {
      const element = makeElement({
        did: uniqueDid(),
        cid: VALID_CID,
        alt: ":x:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();

      const img = element.querySelector("img");
      assert(img !== null);
      img.dispatchEvent(new window.Event("error"));
      await flush();
      assert(element.querySelector("img") === null);
      assert(element.querySelector(".blob-image-fallback") !== null);
    });
  });

  describe("attribute changes", () => {
    it("re-renders when did changes", async () => {
      const didA = uniqueDid();
      const didB = uniqueDid();
      const element = makeElement({
        did: didA,
        cid: VALID_CID,
        alt: ":x:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();
      assert(element.querySelector("img").getAttribute("src").includes(didA));

      element.setAttribute("did", didB);
      await flush();
      assert(element.querySelector("img").getAttribute("src").includes(didB));
    });

    it("clears the error state so a fixed cid stops showing the fallback", async () => {
      const element = makeElement({
        did: uniqueDid(),
        cid: VALID_CID,
        alt: ":x:",
        cdnPrefix: "feed_thumbnail",
      });
      await flush();

      element.querySelector("img").dispatchEvent(new window.Event("error"));
      await flush();
      assert(element.querySelector("img") === null);

      element.setAttribute("cid", VALID_CID.replace("bafk", "bafy"));
      await flush();
      assert(element.querySelector("img") !== null);
    });
  });
});
