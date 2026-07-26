import { SLINGSHOT_URL } from "/js/config.js";

const DID_PATTERN = /^did:(plc|web):[a-zA-Z0-9._%:-]+$/;
const NSID_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/;
const RKEY_PATTERN = /^[a-zA-Z0-9._~:-]{1,512}$/;

function isValidDid(value) {
  return typeof value === "string" && DID_PATTERN.test(value);
}

function isValidNsid(value) {
  return typeof value === "string" && NSID_PATTERN.test(value);
}

export function isValidRkey(value) {
  return (
    typeof value === "string" &&
    value !== "." &&
    value !== ".." &&
    RKEY_PATTERN.test(value)
  );
}

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
