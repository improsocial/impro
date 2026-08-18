import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { buildCdnUrl } from "/js/dataHelpers.js";
import { isValidDid } from "/js/utils.js";

const CID_PATTERN = /^b[a-z2-7]{20,}$/;

function safeBuildCdnUrl(prefix, did, cid) {
  try {
    return buildCdnUrl(prefix, did, cid);
  } catch {
    return null;
  }
}

function isValidCid(cid) {
  return typeof cid === "string" && CID_PATTERN.test(cid);
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
          !failed && isValidDid(did) && isValidCid(cid)
            ? safeBuildCdnUrl(cdnPrefix, did, cid)
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

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "alt") {
      this.state.$alt.set(newValue);
      return;
    }
    this.state.$failed.set(false);
    if (name === "did") {
      this.state.$did.set(newValue);
    } else if (name === "cid") {
      this.state.$cid.set(newValue);
    } else if (name === "cdn-prefix") {
      this.state.$cdnPrefix.set(newValue);
    }
  }
}

PluginBlobImage.register();

export { PluginBlobImage };
