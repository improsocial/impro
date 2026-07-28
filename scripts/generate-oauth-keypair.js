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

console.log("OAUTH_PUBLIC_JWK (build variable):");
console.log(JSON.stringify(publicJwk));
console.log("");
console.log("OAUTH_PRIVATE_JWK (secret — do not commit):");
console.log(JSON.stringify(privateJwk));
