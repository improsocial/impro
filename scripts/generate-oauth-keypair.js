const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const kid = `oauth-${new Date().toISOString().slice(0, 10)}`;
const commonFields = { kid, use: "sig", alg: "ES256" };
const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", publicKey)),
  ...commonFields,
};
const privateJwk = {
  ...(await crypto.subtle.exportKey("jwk", privateKey)),
  ...commonFields,
};

console.info("OAUTH_PUBLIC_JWK (build variable):");
console.info(JSON.stringify(publicJwk));
console.info("");
console.info("OAUTH_PRIVATE_JWK (secret — do not commit):");
console.info(JSON.stringify(privateJwk));
