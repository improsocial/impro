const PDS_SERVICE_ID = "#atproto_pds";

export function getServiceEndpointFromDidDoc(didDoc) {
  const service = didDoc.service.find((s) => s.id === PDS_SERVICE_ID);
  if (!service) {
    throw new Error(
      `No PDS service found in DID doc ${JSON.stringify(didDoc)}`,
    );
  }
  return service.serviceEndpoint;
}

export async function resolveHandle(handle) {
  const params = new URLSearchParams({
    handle,
  });
  const res = await fetch(
    "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?" +
      params.toString(),
  );
  const data = await res.json();
  return data.did;
}

export async function resolveDid(did) {
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
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

async function getServiceEndpointForDid(did) {
  const didDoc = await resolveDid(did);
  return getServiceEndpointFromDidDoc(didDoc);
}

export async function getServiceEndpointForHandle(handle) {
  const did = await resolveHandle(handle);
  if (!did) {
    return null;
  }
  return getServiceEndpointForDid(did);
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

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

let lastTimestamp = 0n;

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
