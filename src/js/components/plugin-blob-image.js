import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { BSKY_CDN_URL } from "/js/config.js";

const DID_PATTERN = /^did:(plc|web):[a-zA-Z0-9._%:-]+$/;
const CID_PATTERN = /^b[a-z2-7]{20,}$/;

const CDN_PREFIXES = new Set([
  "avatar",
  "avatar_thumbnail",
  "banner",
  "feed_thumbnail",
  "feed_fullsize",
]);

function isValidDid(did) {
  return typeof did === "string" && DID_PATTERN.test(did);
}

function isValidCid(cid) {
  return typeof cid === "string" && CID_PATTERN.test(cid);
}

function buildCdnUrl(prefix, did, cid) {
  return `${BSKY_CDN_URL}/img/${prefix}/plain/${did}/${cid}@jpeg`;
}

class PluginBlobImage extends Component {
  static get observedAttributes() {
    return ["did", "cid", "alt", "cdn-prefix"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.state = new ReactiveStore("plugin-blob-image");
    this.state.$did = new Signal.State(this.getAttribute("did"));
    this.state.$cid = new Signal.State(this.getAttribute("cid"));
    this.state.$alt = new Signal.State(this.getAttribute("alt"));
    this.state.$cdnPrefix = new Signal.State(this.getAttribute("cdn-prefix"));
    this.state.$failed = new Signal.State(false);
    this._disposers = [
      effect(() => {
        const did = this.state.$did.get();
        const cid = this.state.$cid.get();
        const cdnPrefix = this.state.$cdnPrefix.get();
        const alt = this.state.$alt.get() ?? "";
        const failed = this.state.$failed.get();
        const src =
          !failed &&
          isValidDid(did) &&
          isValidCid(cid) &&
          CDN_PREFIXES.has(cdnPrefix)
            ? buildCdnUrl(cdnPrefix, did, cid)
            : null;
        if (src) {
          render(
            html`<img
              src="${src}"
              alt="${alt}"
              @error="${() => this.state.$failed.set(true)}"
            />`,
            this,
          );
        } else {
          render(html`<span class="blob-image-fallback">${alt}</span>`, this);
        }
      }),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
  }

  attributeChangedCallback() {
    if (!this.initialized) return;
    this.state.$failed.set(false);
    this.state.$did.set(this.getAttribute("did"));
    this.state.$cid.set(this.getAttribute("cid"));
    this.state.$alt.set(this.getAttribute("alt"));
    this.state.$cdnPrefix.set(this.getAttribute("cdn-prefix"));
  }
}

PluginBlobImage.register();

export { PluginBlobImage };
