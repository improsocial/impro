import fc from "fast-check";

// Replay a failure with the seed fast-check printed:
//   FC_SEED=1234 npm run test:property
const seedInput = process.env.FC_SEED;

if (seedInput) {
  const seed = Number(seedInput);
  if (!Number.isInteger(seed)) {
    throw new Error(`FC_SEED must be an integer, got "${seedInput}"`);
  }
  fc.configureGlobal({ seed });
}
