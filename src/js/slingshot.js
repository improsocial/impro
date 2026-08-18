import { SLINGSHOT_URL } from "/js/config.js";
import {
  fetchWithTimeout,
  isValidDid,
  isValidHandle,
  isValidNsid,
  isValidRkey,
} from "/js/utils.js";

const REQUEST_TIMEOUT_MS = 5000;

export class Slingshot {
  constructor({ fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    this.fetchImpl = fetchImpl ?? null;
    this.timeoutMs = timeoutMs;
  }

  _fetch(url, label) {
    return fetchWithTimeout(url, {
      timeoutMs: this.timeoutMs,
      label,
      fetchImpl: this.fetchImpl,
    });
  }

  async getRecord({ repo, collection, rkey }) {
    if (!isValidDid(repo)) {
      throw new Error(`getRecord: invalid repo "${repo}"`);
    }
    if (!isValidNsid(collection)) {
      throw new Error(`getRecord: invalid collection "${collection}"`);
    }
    if (!isValidRkey(rkey)) {
      throw new Error(`getRecord: invalid rkey "${rkey}"`);
    }
    const params = new URLSearchParams({ repo, collection, rkey });
    const url = `${SLINGSHOT_URL}/xrpc/com.atproto.repo.getRecord?${params.toString()}`;
    const res = await this._fetch(url, "getRecord");
    if (res.status === 400) {
      const data = await res.json().catch(() => null);
      if (data?.error === "RecordNotFound") return null;
      throw new Error(
        `getRecord: ${data?.error ?? "InvalidRequest"} ${data?.message ?? ""}`.trim(),
      );
    }
    if (!res.ok) {
      throw new Error(`getRecord: HTTP ${res.status}`);
    }
    return await res.json();
  }

  async resolveHandle(handle) {
    if (!isValidHandle(handle)) {
      throw new Error(`resolveHandle: invalid handle "${handle}"`);
    }
    const params = new URLSearchParams({ handle });
    const url = `${SLINGSHOT_URL}/xrpc/com.atproto.identity.resolveHandle?${params.toString()}`;
    const data = await this._readJson(url, "resolveHandle");
    if (!isValidDid(data?.did)) {
      throw new Error(`resolveHandle: no DID in response for "${handle}"`);
    }
    return data.did;
  }

  async resolveMiniDoc(identifier) {
    if (!isValidHandle(identifier) && !isValidDid(identifier)) {
      throw new Error(`resolveMiniDoc: invalid identifier "${identifier}"`);
    }
    const params = new URLSearchParams({ identifier });
    const url = `${SLINGSHOT_URL}/xrpc/blue.microcosm.identity.resolveMiniDoc?${params.toString()}`;
    const data = await this._readJson(url, "resolveMiniDoc");
    if (!isValidDid(data?.did) || !data?.pds) {
      throw new Error(
        `resolveMiniDoc: incomplete document for "${identifier}"`,
      );
    }
    return {
      did: data.did,
      handle: data.handle ?? null,
      pds: data.pds,
      signingKey: data.signing_key ?? null,
    };
  }

  async _readJson(url, label) {
    const res = await this._fetch(url, label);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        `${label}: HTTP ${res.status} ${data?.error ?? ""} ${data?.message ?? ""}`.trim(),
      );
    }
    return await res.json();
  }
}
