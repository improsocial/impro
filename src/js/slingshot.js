import { SLINGSHOT_URL } from "/js/config.js";
import { isValidDid, isValidNsid, isValidRkey } from "/js/atproto.js";

export class Slingshot {
  constructor({ fetchImpl } = {}) {
    this.fetchImpl = fetchImpl ?? ((url) => globalThis.fetch(url));
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
    const res = await this.fetchImpl(url);
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
}
