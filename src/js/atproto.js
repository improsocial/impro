import { HANDLE_RESOLVER_SERVICE_URL, PLC_DIRECTORY_URL } from "/js/config.js";

const PDS_SERVICE_ID = "#atproto_pds";

export function getServiceEndpointFromDidDoc(
  didDoc,
  serviceId = PDS_SERVICE_ID,
) {
  const service = didDoc.service?.find((s) => s.id === serviceId);
  if (!service) {
    throw new Error(
      `No ${serviceId} service found in DID doc ${JSON.stringify(didDoc)}`,
    );
  }
  return service.serviceEndpoint;
}

export function didDocReferencesHandle(didDoc, handle) {
  const atHandle = "at://" + handle;
  const aliases = didDoc.alsoKnownAs ?? [];
  return aliases.includes(atHandle);
}

const RESOLVE_HANDLE_TIMEOUT_MS = 5000;

export async function resolveHandle(handle) {
  const params = new URLSearchParams({
    handle,
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    RESOLVE_HANDLE_TIMEOUT_MS,
  );
  let res;
  try {
    res = await fetch(
      `${HANDLE_RESOLVER_SERVICE_URL}/xrpc/com.atproto.identity.resolveHandle?` +
        params.toString(),
      { signal: controller.signal },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `resolveHandle: timed out after ${RESOLVE_HANDLE_TIMEOUT_MS}ms resolving "${handle}"`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const data = await res.json();
  return data.did ?? null;
}

export async function resolveDid(did) {
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`${PLC_DIRECTORY_URL}/${encodeURIComponent(did)}`);
    const didDoc = await res.json();
    return didDoc;
  } else if (did.startsWith("did:web:")) {
    const website = did.split(":")[2];
    const res = await fetch(`https://${website}/.well-known/did.json`);
    const didDoc = await res.json();
    return didDoc;
  } else {
    throw new Error(`Unsupported DID: ${did}`);
  }
}

export async function resolveIdentity(handle) {
  const did = await resolveHandle(handle);
  if (!did) return null;
  const didDoc = await resolveDid(did);
  if (!didDocReferencesHandle(didDoc, handle)) {
    throw new Error(`DID doc for ${did} does not reference handle: ${handle}`);
  }
  return { did, didDoc };
}

export async function getServiceEndpointForHandle(handle) {
  const result = await resolveIdentity(handle);
  if (!result) {
    throw new HandleNotFoundError("DID not found for handle: " + handle);
  }
  return getServiceEndpointFromDidDoc(result.didDoc);
}

export class IdentityResolver {
  constructor() {
    this.handleToDidMap = new Map();
  }

  async resolveHandle(handle) {
    if (this.handleToDidMap.has(handle)) {
      return this.handleToDidMap.get(handle);
    }
    console.debug("[IdentityResolver] Resolving handle", handle);
    const did = await resolveHandle(handle);
    this.handleToDidMap.set(handle, did);
    return did;
  }

  setDidForHandle(handle, did) {
    this.handleToDidMap.set(handle, did);
  }
}

const DID_PATTERN = /^did:(plc|web):[a-zA-Z0-9._%:-]+$/;
const NSID_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/;
const RKEY_PATTERN = /^[a-zA-Z0-9._~:-]{1,512}$/;

export function isValidDid(value) {
  return typeof value === "string" && DID_PATTERN.test(value);
}

export function isValidNsid(value) {
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
