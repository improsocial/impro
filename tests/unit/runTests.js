import fs from "fs";

import "./env.js";

let testFiles = [];

// If test files are provided as arguments, use them
// Otherwise, get test files from the tests directory
if (process.argv.length > 2) {
  testFiles = process.argv.slice(2);
} else {
  // Get test files, pattern is **/*.test.js
  // And may be in subdirectories
  testFiles = fs.globSync("tests/unit/specs/**/*.test.js");
}

const results = [];

for (const testFile of testFiles) {
  try {
    console.info(`${testFile}`);
    await import(`../../${testFile}`);
    results.push({ name: testFile, success: true });
  } catch (error) {
    results.push({ name: testFile, success: false, error: error.message });
    console.error(`Error running test file ${testFile}: ${error}`);
  }
}

console.info(`${results.length} test suites run`);
const passed = results.filter((result) => result.success);
const failed = results.filter((result) => !result.success);
console.info(`${passed.length} passed`);
console.info(`${failed.length} failed`);
for (const result of failed) {
  console.error(`${result.name} - ${result.error}`);
}

const success = failed.length === 0;

process.exit(success ? 0 : 1);
