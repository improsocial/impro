// Writes settings.json as the place.wisp.settings record for a site.
// Usage: APP_PW=xxxx-xxxx-xxxx-xxxx node deploy/wisp/put-settings.js <did> <site>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(__dirname, "settings.json");

const [did, site] = process.argv.slice(2);
const password = process.env.APP_PW;
if (!did || !site || !password) {
  throw new Error(
    "Usage: APP_PW=<app password> node deploy/wisp/put-settings.js <did> <site>",
  );
}

async function call(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const record = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

const didDoc = await call(`https://plc.directory/${did}`);
const pds = didDoc.service.find(
  (service) => service.id === "#atproto_pds",
).serviceEndpoint;

const session = await call(`${pds}/xrpc/com.atproto.server.createSession`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: did, password }),
});

const result = await call(`${pds}/xrpc/com.atproto.repo.putRecord`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessJwt}`,
  },
  body: JSON.stringify({
    repo: did,
    collection: "place.wisp.settings",
    rkey: site,
    record,
  }),
});
console.info(`Wrote ${result.uri}`);
