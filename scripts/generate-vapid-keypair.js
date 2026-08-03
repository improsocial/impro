const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

const publicKeyRaw = await crypto.subtle.exportKey("raw", publicKey);
const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);

console.log("VAPID_PUBLIC_KEY (build variable):");
console.log(base64UrlEncode(publicKeyRaw));
console.log("");
console.log("VAPID_PRIVATE_JWK (secret — do not commit):");
console.log(JSON.stringify(privateJwk));
console.log("");
console.log(
  "VAPID_SUBJECT (build variable — a mailto: or https: contact, required by RFC 8292):",
);
console.log("mailto:you@example.com");
