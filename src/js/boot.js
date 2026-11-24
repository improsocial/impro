import { enableErrorLogs } from "/js/errorLogs.js";
import "/js/perf.js";
import { main } from "/js/app.js";

const params = new URLSearchParams(window.location.search);

// Dev tools
if (
  (window.env.environment === "development" && !window.env.playwright) ||
  params.has("enable-debug")
) {
  enableErrorLogs();
  const devVersionOverlay = document.createElement("div");
  devVersionOverlay.className = "dev-version-overlay";
  devVersionOverlay.textContent = `v${window.env.version} - ${window.env.gitCommit}`;
  document.body.appendChild(devVersionOverlay);
}

main().then(
  () => {
    window.bootUi.ready();
  },
  (error) => {
    console.error("Error in main function:", error);
    window.bootUi.showError();
  },
);
