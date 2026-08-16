import { resolveIdentity, getServiceEndpointFromDidDoc } from "/js/atproto.js";
import { KVIndexedDB } from "/js/utils.js";

export function decodeTangledBlobContent(data, file) {
  if (typeof data.content !== "string") {
    throw new Error(`tangled blob response for "${file}" has no content`);
  }
  if (data.encoding === "base64") {
    const binary = atob(data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  return new TextEncoder().encode(data.content).buffer;
}

async function findRepoRecord(pds, ownerDid, repoName) {
  const directUrl =
    `${pds}/xrpc/com.atproto.repo.getRecord?` +
    new URLSearchParams({
      repo: ownerDid,
      collection: "sh.tangled.repo",
      rkey: repoName,
    });
  const directResponse = await fetch(directUrl);
  if (directResponse.ok) {
    const record = await directResponse.json();
    if (record.value) return record.value;
  }
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      repo: ownerDid,
      collection: "sh.tangled.repo",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(
      `${pds}/xrpc/com.atproto.repo.listRecords?${params}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const records = data.records ?? [];
    const match = records.find((record) => record.value?.name === repoName);
    if (match) return match.value;
    if (!data.cursor || records.length === 0) return null;
    cursor = data.cursor;
  }
  return null;
}

const REPO_INFO_REVALIDATE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// Resolves an "<ownerHandle>/<repoName>" path to the {knot, repoDid} pair its
// blobs are served from.
export class TangledResolver {
  constructor() {
    this._pending = new Map();
    this._store = new KVIndexedDB("tangled-repo-info", "repoInfoByPath");
  }

  async resolveRepoInfo(path) {
    if (this._pending.has(path)) {
      return this._pending.get(path);
    }
    const promise = (async () => {
      const persisted = await this._read(path);
      if (persisted?.knot && persisted?.repoDid) {
        const age = Date.now() - (persisted.resolvedAt ?? 0);
        if (age > REPO_INFO_REVALIDATE_AFTER_MS) {
          this._revalidate(path);
        }
        return { knot: persisted.knot, repoDid: persisted.repoDid };
      }
      const info = await this._resolveFromNetwork(path);
      await this._write(path, info);
      return info;
    })();
    // Don't cache a failed resolution — allow retrying on a later call.
    promise.catch(() => this._pending.delete(path));
    this._pending.set(path, promise);
    return promise;
  }

  async invalidate(path) {
    this._pending.delete(path);
    try {
      await this._store.delete(path);
    } catch (error) {
      console.warn(
        `Could not clear cached tangled repo info for "${path}"`,
        error,
      );
    }
  }

  async _resolveFromNetwork(path) {
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) {
      throw new Error(`Invalid tangled repo path "${path}"`);
    }
    const ownerHandle = path.slice(0, slashIndex);
    const repoName = path.slice(slashIndex + 1);

    const identity = await resolveIdentity(ownerHandle);
    if (!identity) {
      throw new Error(`Could not resolve tangled repo owner "${ownerHandle}"`);
    }
    const pds = getServiceEndpointFromDidDoc(identity.didDoc);

    const record = await findRepoRecord(pds, identity.did, repoName);
    if (!record) {
      throw new Error(
        `Could not find a tangled repo record named "${repoName}" for "${ownerHandle}"`,
      );
    }
    const { knot, repoDid } = record;
    if (!knot || !repoDid) {
      throw new Error(
        `tangled repo record for "${path}" is missing knot/repoDid`,
      );
    }
    return { knot, repoDid };
  }

  _revalidate(path) {
    this._resolveFromNetwork(path)
      .then((info) => this._write(path, info))
      .catch((error) => {
        console.warn(
          `Could not revalidate tangled repo info for "${path}"`,
          error,
        );
      });
  }

  async _read(path) {
    try {
      return (await this._store.get(path)) ?? null;
    } catch (error) {
      console.warn(
        `Could not read cached tangled repo info for "${path}"`,
        error,
      );
      return null;
    }
  }

  async _write(path, { knot, repoDid }) {
    try {
      await this._store.put(path, { knot, repoDid, resolvedAt: Date.now() });
    } catch (error) {
      console.warn(`Could not cache tangled repo info for "${path}"`, error);
    }
  }
}
