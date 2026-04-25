import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const LOCAL_PORT = 8080;
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function isCloudflaredInstalled() {
  const result = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function startCloudflared() {
  return spawn(
    "cloudflared",
    ["tunnel", "--url", `http://localhost:${LOCAL_PORT}`, "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

function waitForTunnelUrl(cloudflared) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let resolved = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      if (resolved) return;
      buffer += text;
      const match = buffer.match(TUNNEL_URL_PATTERN);
      if (match) {
        resolved = true;
        cloudflared.stderr.off("data", onData);
        cloudflared.stdout.off("data", onData);
        resolve(match[0]);
      }
    };

    cloudflared.stderr.on("data", onData);
    cloudflared.stdout.on("data", onData);
    cloudflared.on("exit", (code) => {
      if (!resolved) {
        reject(
          new Error(
            `cloudflared exited before printing a tunnel URL (code ${code})`,
          ),
        );
      }
    });
  });
}

function startEleventy(hostName) {
  rmSync("build", { recursive: true, force: true });
  const env = { ...process.env, NODE_ENV: "development" };
  if (hostName) env.HOST_NAME = hostName;
  return spawn("npx", ["@11ty/eleventy", "--serve"], {
    stdio: "inherit",
    env,
  });
}

async function startTunnel() {
  if (!isCloudflaredInstalled()) {
    console.error(
      "cloudflared not found. Install it to run the dev tunnel:\n" +
        "  macOS: brew install cloudflared\n" +
        "  Other: https://github.com/cloudflare/cloudflared/releases\n",
    );
    process.exit(1);
  }

  console.info("Starting cloudflared tunnel...");
  const cloudflared = startCloudflared();
  const tunnelUrl = await waitForTunnelUrl(cloudflared);
  const hostName = tunnelUrl.replace(/^https:\/\//, "");

  console.info(
    "\n============================================================",
  );
  console.info(`Tunnel ready: ${tunnelUrl}`);
  console.info(
    "============================================================\n",
  );

  return { cloudflared, hostName };
}

async function main() {
  const { cloudflared, hostName } = await startTunnel();
  const eleventy = startEleventy(hostName);

  let shuttingDown = false;
  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!cloudflared.killed) cloudflared.kill("SIGTERM");
    if (!eleventy.killed) eleventy.kill("SIGTERM");
    process.exit(code ?? 0);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  cloudflared.on("exit", (code) => shutdown(code ?? 0));
  eleventy.on("exit", (code) => shutdown(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
