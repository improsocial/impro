import { HANDLE_RESOLVER_SERVICE_URL, PLC_DIRECTORY_URL } from "/js/config.js";
import { fetchWithTimeout, isValidDid } from "/js/utils.js";
import { Slingshot } from "/js/slingshot.js";

const PDS_SERVICE_ID = "#atproto_pds";

export class HandleNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "HandleNotFoundError";
  }
}

export function findServiceEndpointInDidDoc(
  didDoc,
  serviceId = PDS_SERVICE_ID,
) {
  const service = didDoc?.service?.find((s) => s.id === serviceId);
  return service?.serviceEndpoint ?? null;
}

export function getServiceEndpointFromDidDoc(
  didDoc,
  serviceId = PDS_SERVICE_ID,
) {
  const endpoint = findServiceEndpointInDidDoc(didDoc, serviceId);
  if (!endpoint) {
    throw new Error(
      `No ${serviceId} service found in DID doc ${JSON.stringify(didDoc)}`,
    );
  }
  return endpoint;
}

export function didDocReferencesHandle(didDoc, handle) {
  const atHandle = "at://" + handle;
  const aliases = didDoc.alsoKnownAs ?? [];
  return aliases.includes(atHandle);
}

const RESOLVE_TIMEOUT_MS = 5000;

export async function resolveHandle(handle) {
  const params = new URLSearchParams({
    handle,
  });
  const res = await fetchWithTimeout(
    `${HANDLE_RESOLVER_SERVICE_URL}/xrpc/com.atproto.identity.resolveHandle?` +
      params.toString(),
    { timeoutMs: RESOLVE_TIMEOUT_MS, label: `resolveHandle "${handle}"` },
  );
  if (res.status === 400) return null;
  if (!res.ok) {
    throw new Error(`resolveHandle "${handle}": HTTP ${res.status}`);
  }
  const data = await res.json();
  return isValidDid(data?.did) ? data.did : null;
}

// Returns null for a DID that isn't registered (or has been tombstoned),
// throws otherwise
export async function resolveDid(did) {
  let url;
  if (did.startsWith("did:plc:")) {
    url = `${PLC_DIRECTORY_URL}/${encodeURIComponent(did)}`;
  } else if (did.startsWith("did:web:")) {
    url = `https://${did.split(":")[2]}/.well-known/did.json`;
  } else {
    throw new Error(`Unsupported DID: ${did}`);
  }
  const res = await fetchWithTimeout(url, {
    timeoutMs: RESOLVE_TIMEOUT_MS,
    label: `resolveDid "${did}"`,
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    throw new Error(`resolveDid "${did}": HTTP ${res.status}`);
  }
  return await res.json();
}

export async function resolveIdentity(handle) {
  const did = await resolveHandle(handle);
  if (!did) return null;
  const didDoc = await resolveDid(did);
  if (!didDoc) return null;
  if (!didDocReferencesHandle(didDoc, handle)) {
    throw new Error(`DID doc for ${did} does not reference handle: ${handle}`);
  }
  return { did, didDoc };
}

let slingshotClient = null;

function getSlingshot() {
  slingshotClient ??= new Slingshot();
  return slingshotClient;
}

const DEFAULT_HANDLE_PROVIDERS = [
  { name: "bluesky", resolve: (handle) => resolveHandle(handle) },
  {
    name: "slingshot",
    resolve: (handle) => getSlingshot().resolveHandle(handle),
  },
];

async function resolveHandleWithFallback(handle, providers) {
  let lastError = null;
  for (const provider of providers) {
    try {
      return await provider.resolve(handle);
    } catch (error) {
      lastError = error;
      console.debug(
        `[IdentityResolver] provider "${provider.name}" could not resolve "${handle}"`,
        error,
      );
    }
  }
  throw lastError ?? new Error(`resolveHandle: no providers for "${handle}"`);
}

function miniDocMatchesIdentifier(miniDoc, identifier) {
  if (isValidDid(identifier)) {
    return miniDoc.did === identifier;
  }
  return miniDoc.handle?.toLowerCase() === identifier.toLowerCase();
}

// Resolves a handle or DID to its DID and PDS endpoint.
export async function resolveIdentityEndpoint(handleOrDid) {
  try {
    const miniDoc = await getSlingshot().resolveMiniDoc(handleOrDid);
    if (miniDocMatchesIdentifier(miniDoc, handleOrDid)) {
      return { did: miniDoc.did, pds: miniDoc.pds };
    }
    console.debug(
      `[resolveIdentityEndpoint] slingshot returned a mismatched identity for "${handleOrDid}"`,
      miniDoc,
    );
  } catch (error) {
    console.debug(
      `[resolveIdentityEndpoint] slingshot could not resolve "${handleOrDid}"`,
      error,
    );
  }
  if (isValidDid(handleOrDid)) {
    const didDoc = await resolveDid(handleOrDid);
    const pds = findServiceEndpointInDidDoc(didDoc);
    return pds ? { did: handleOrDid, pds } : null;
  }
  const result = await resolveIdentity(handleOrDid);
  if (!result) return null;
  const pds = findServiceEndpointInDidDoc(result.didDoc);
  return pds ? { did: result.did, pds } : null;
}

const HANDLE_NOT_FOUND_TTL_MS = 30_000;
const ENDPOINT_TTL_MS = 300_000;

export class IdentityResolver {
  constructor({
    providers = DEFAULT_HANDLE_PROVIDERS,
    notFoundTtlMs = HANDLE_NOT_FOUND_TTL_MS,
    endpointTtlMs = ENDPOINT_TTL_MS,
  } = {}) {
    this.providers = providers;
    this.notFoundTtlMs = notFoundTtlMs;
    this.endpointTtlMs = endpointTtlMs;
    this.handleToDidMap = new Map();
    this.endpointCache = new Map();
    this.notFoundAt = new Map();
    this.inFlight = new Map();
    this.endpointInFlight = new Map();
  }

  _isNotFound(identifier) {
    const notFoundAt = this.notFoundAt.get(identifier);
    if (notFoundAt == null) return false;
    if (Date.now() - notFoundAt < this.notFoundTtlMs) return true;
    this.notFoundAt.delete(identifier);
    return false;
  }

  _dedupe(inFlight, identifier, start) {
    const existing = inFlight.get(identifier);
    if (existing) return existing;
    const resolution = start().finally(() => inFlight.delete(identifier));
    inFlight.set(identifier, resolution);
    return resolution;
  }

  async resolveHandle(handle) {
    if (this.handleToDidMap.has(handle)) {
      return this.handleToDidMap.get(handle);
    }
    if (this._isNotFound(handle)) return null;
    return this._dedupe(this.inFlight, handle, () => {
      console.debug("[IdentityResolver] Resolving handle", handle);
      return resolveHandleWithFallback(handle, this.providers).then((did) => {
        if (did) {
          this.handleToDidMap.set(handle, did);
        } else {
          this.notFoundAt.set(handle, Date.now());
        }
        return did;
      });
    });
  }

  async resolveEndpoint(handleOrDid) {
    const cached = this.endpointCache.get(handleOrDid);
    if (cached && Date.now() - cached.at < this.endpointTtlMs) {
      return cached.result;
    }
    if (this._isNotFound(handleOrDid)) return null;
    return this._dedupe(this.endpointInFlight, handleOrDid, () => {
      console.debug("[IdentityResolver] Resolving endpoint", handleOrDid);
      return resolveIdentityEndpoint(handleOrDid).then((result) => {
        if (result) {
          this.endpointCache.set(handleOrDid, { at: Date.now(), result });
          if (!isValidDid(handleOrDid)) {
            this.handleToDidMap.set(handleOrDid, result.did);
          }
        } else {
          this.notFoundAt.set(handleOrDid, Date.now());
        }
        return result;
      });
    });
  }

  setDidForHandle(handle, did) {
    this.notFoundAt.delete(handle);
    this.endpointCache.delete(handle);
    this.handleToDidMap.set(handle, did);
  }
}

export async function getServiceEndpointForHandle(handle, resolver) {
  const result = await resolver.resolveEndpoint(handle);
  if (!result) {
    throw new HandleNotFoundError("DID not found for handle: " + handle);
  }
  return result.pds;
}

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

let lastTimestamp = 0n;

// Will return null if the rkey is not a TID.
export function getTimestampFromRkey(rkey) {
  const noDashes = rkey.replaceAll("-", "");
  if (noDashes.length !== 13) {
    return null;
  }
  let value = 0;
  for (const c of noDashes.slice(0, 11)) {
    value = value * 32 + TID_ALPHABET.indexOf(c);
  }
  return value;
}

export function generateTid() {
  const nowMicroseconds = BigInt(Date.now()) * 1000n;
  const timestamp =
    nowMicroseconds <= lastTimestamp ? lastTimestamp + 1n : nowMicroseconds;
  lastTimestamp = timestamp;
  const clockSeq = BigInt(Math.floor(Math.random() * 1024));
  let tid = (timestamp << 10n) | clockSeq;
  let result = "";
  for (let i = 0; i < 13; i++) {
    const remainder = tid % 32n;
    result = TID_ALPHABET[Number(remainder)] + result;
    tid = tid / 32n;
  }
  return result;
}

// Note: the DAG-CBOR encoder was written fully by Claude.
// Unit tested against reference implementation outputs
// for additional confidence.

const CID_BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32Encode(bytes) {
  let result = "";
  let buffer = 0;
  let bitCount = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      result += CID_BASE32_ALPHABET[(buffer >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }
  if (bitCount > 0) {
    result += CID_BASE32_ALPHABET[(buffer << (5 - bitCount)) & 31];
  }
  return result;
}

function base32Decode(str) {
  const bytes = [];
  let buffer = 0;
  let bitCount = 0;
  for (const char of str) {
    const index = CID_BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    buffer = (buffer << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      bytes.push((buffer >>> (bitCount - 8)) & 0xff);
      bitCount -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function cborTypeAndArg(bytes, majorType, arg) {
  const majorBits = majorType << 5;
  if (arg < 24) {
    bytes.push(majorBits | arg);
  } else if (arg <= 0xff) {
    bytes.push(majorBits | 24, arg);
  } else if (arg <= 0xffff) {
    bytes.push(majorBits | 25, arg >>> 8, arg & 0xff);
  } else if (arg <= 0xffffffff) {
    bytes.push(
      majorBits | 26,
      (arg >>> 24) & 0xff,
      (arg >>> 16) & 0xff,
      (arg >>> 8) & 0xff,
      arg & 0xff,
    );
  } else {
    const high = Math.floor(arg / 0x100000000);
    const low = arg % 0x100000000;
    bytes.push(
      majorBits | 27,
      (high >>> 24) & 0xff,
      (high >>> 16) & 0xff,
      (high >>> 8) & 0xff,
      high & 0xff,
      (low >>> 24) & 0xff,
      (low >>> 16) & 0xff,
      (low >>> 8) & 0xff,
      low & 0xff,
    );
  }
}

function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isCidLink(value) {
  return (
    isPlainObject(value) &&
    typeof value.$link === "string" &&
    Object.keys(value).length === 1
  );
}

// Covers only the value types that appear in atproto records
// (strings, safe integers, booleans, null, arrays,
// string-keyed plain objects, and CID references).
function cborEncodeValue(bytes, value) {
  if (typeof value === "string") {
    const encoded = new TextEncoder().encode(value);
    cborTypeAndArg(bytes, 3, encoded.length);
    bytes.push(...encoded);
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Cannot CBOR-encode non-integer number: ${value}`);
    }
    if (value >= 0) {
      cborTypeAndArg(bytes, 0, value);
    } else {
      cborTypeAndArg(bytes, 1, -value - 1);
    }
  } else if (typeof value === "boolean") {
    bytes.push(value ? 0xf5 : 0xf4);
  } else if (value === null) {
    bytes.push(0xf6);
  } else if (Array.isArray(value)) {
    cborTypeAndArg(bytes, 4, value.length);
    for (const element of value) {
      cborEncodeValue(bytes, element);
    }
  } else if (isCidLink(value)) {
    if (!value.$link.startsWith("b")) {
      throw new Error(
        `Unsupported CID multibase (expected base32): ${value.$link}`,
      );
    }
    const cidBytes = base32Decode(value.$link.slice(1));
    bytes.push(0xd8, 42);
    cborTypeAndArg(bytes, 2, cidBytes.length + 1);
    bytes.push(0);
    bytes.push(...cidBytes);
  } else if (isPlainObject(value)) {
    const textEncoder = new TextEncoder();
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => ({
        keyBytes: textEncoder.encode(key),
        value: entryValue,
      }))
      .sort((a, b) => {
        if (a.keyBytes.length !== b.keyBytes.length) {
          return a.keyBytes.length - b.keyBytes.length;
        }
        for (let i = 0; i < a.keyBytes.length; i++) {
          if (a.keyBytes[i] !== b.keyBytes[i]) {
            return a.keyBytes[i] - b.keyBytes[i];
          }
        }
        return 0;
      });
    cborTypeAndArg(bytes, 5, entries.length);
    for (const entry of entries) {
      cborTypeAndArg(bytes, 3, entry.keyBytes.length);
      bytes.push(...entry.keyBytes);
      cborEncodeValue(bytes, entry.value);
    }
  } else {
    throw new Error(`Cannot CBOR-encode value of type ${typeof value}`);
  }
}

// CIDv1 (0x01), dag-cbor codec (0x71), sha-256 (0x12), 32-byte digest (0x20).
const CID_HEADER = [0x01, 0x71, 0x12, 0x20];

export async function computeRecordCid(record) {
  const encoded = [];
  cborEncodeValue(encoded, record);
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(encoded));
  const cidBytes = new Uint8Array([...CID_HEADER, ...new Uint8Array(digest)]);
  return "b" + base32Encode(cidBytes);
}
