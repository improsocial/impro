import { spawn } from "node:child_process";
import { globSync, statSync } from "node:fs";
import path from "node:path";

// Like node --test, but runs the files in --workers=N processes total

const startTime = Date.now();

let workerCount = 4;

const nodeArgs = [];
const patterns = [];
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--workers=")) {
    workerCount = Number(arg.slice("--workers=".length));
  } else if (arg.startsWith("-")) {
    nodeArgs.push(arg);
  } else {
    patterns.push(arg);
  }
}

if (!Number.isInteger(workerCount) || workerCount < 1) {
  console.error("--workers must be a positive integer");
  process.exit(1);
}

if (patterns.length === 0) {
  console.error(
    "Usage: node scripts/node-test-parallel.js [--workers=N] [node flags...] <test files/globs...>",
  );
  console.error("Flags taking a value must use the --flag=value form.");
  process.exit(1);
}

const specFiles = patterns.flatMap((pattern) =>
  globSync(pattern).flatMap((match) =>
    statSync(match).isDirectory()
      ? globSync(path.join(match, "**/*.test.js"))
      : [match],
  ),
);

if (specFiles.length === 0) {
  console.error(`No test files matched: ${patterns.join(" ")}`);
  process.exit(1);
}

const buckets = Array.from({ length: workerCount }, () => ({
  files: [],
  totalSize: 0,
}));

const filesBySize = specFiles
  .map((file) => ({ file, size: statSync(file).size }))
  .sort((left, right) => right.size - left.size);

for (const { file, size } of filesBySize) {
  const smallest = buckets.reduce((best, bucket) =>
    bucket.totalSize < best.totalSize ? bucket : best,
  );
  smallest.files.push(file);
  smallest.totalSize += size;
}

const runWorker = (files, workerNumber) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [...nodeArgs, "--test-isolation=none", "--test", ...files],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("close", (code) => {
      resolve({
        code,
        files,
        workerNumber,
        output: Buffer.concat(chunks).toString(),
      });
    });
  });

const results = await Promise.all(
  buckets
    .filter((bucket) => bucket.files.length > 0)
    .map((bucket, index) => runWorker(bucket.files, index + 1)),
);

const SUMMED_STATS = [
  "tests",
  "suites",
  "pass",
  "fail",
  "cancelled",
  "skipped",
  "todo",
  "slow",
];
const combinedStats = Object.fromEntries(SUMMED_STATS.map((stat) => [stat, 0]));
let slowestWorkerMs = 0;
let foundStats = false;

const statLinePattern = /^ℹ (\w+) ([\d.]+)$/;

for (const result of results) {
  const keptLines = [];
  for (const line of result.output.split("\n")) {
    const match = line.match(statLinePattern);
    if (match && SUMMED_STATS.includes(match[1])) {
      combinedStats[match[1]] += Number(match[2]);
      if (match[1] === "fail") result.failCount = Number(match[2]);
      foundStats = true;
    } else if (match && match[1] === "duration_ms") {
      slowestWorkerMs = Math.max(slowestWorkerMs, Number(match[2]));
    } else {
      keptLines.push(line);
    }
  }
  result.keptLines = keptLines;
  process.stdout.write(keptLines.join("\n"));
}

if (foundStats) {
  for (const stat of SUMMED_STATS) {
    process.stdout.write(`ℹ ${stat} ${combinedStats[stat]}\n`);
  }
  process.stdout.write(
    `ℹ slowest worker ${(slowestWorkerMs / 1000).toFixed(2)}s\n`,
  );
}
const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
process.stdout.write(`ℹ total duration ${elapsedSeconds}s\n`);

const TAIL_LINES = 20;
const failures = results.filter((result) => result.code !== 0);

for (const failure of failures) {
  process.stdout.write(
    `\n✖ worker ${failure.workerNumber} exited with code ${failure.code}\n`,
  );
  if (failure.failCount === 0) {
    // Node exits non-zero on an unhandled rejection even when every test passed
    process.stdout.write(
      "  (0 test failures — likely an unhandled rejection or async activity outliving a test)\n",
    );
  }
  process.stdout.write(`  files: ${failure.files.join(" ")}\n`);
  const tail = failure.keptLines
    .filter((line) => line.trim() !== "")
    .slice(-TAIL_LINES);
  process.stdout.write(
    `  last ${tail.length} lines of its output:\n${tail
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  );
}

process.exitCode = failures.length > 0 ? 1 : 0;
