import { html, render } from "/js/lib/lit-html.js";

const LEVEL_STYLES = {
  error: {
    background: "rgba(255, 0, 0, 0.9)",
    color: "white",
  },
  warn: {
    background: "rgba(255, 200, 0, 0.9)",
    color: "black",
  },
};

function formatArg(arg) {
  if (typeof arg === "string") {
    return arg;
  }
  if (arg instanceof Error || arg?.message || arg?.stack) {
    const message = arg.message ?? String(arg);
    const stack = arg.stack ?? "";
    return stack.includes(message) ? stack : `${message}\n${stack}`;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function enableErrorLogs() {
  const errorLog = document.createElement("div");
  errorLog.id = "error-log";
  errorLog.style.cssText = `
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 200px;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999999;
  display: none;
`;
  document.body.appendChild(errorLog);

  const entriesContainer = document.createElement("div");
  entriesContainer.style.cssText = `
  max-height: 200px;
  overflow-y: auto;
`;
  errorLog.appendChild(entriesContainer);

  const clearAllButton = document.createElement("button");
  clearAllButton.textContent = "Clear all";
  clearAllButton.style.cssText = `
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 4px 8px;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
  z-index: 1;
`;
  clearAllButton.addEventListener("click", () => {
    entriesContainer.replaceChildren();
    errorLog.style.display = "none";
  });
  errorLog.appendChild(clearAllButton);

  function showMessage(message, level = "error") {
    const { background, color } = LEVEL_STYLES[level];
    errorLog.style.display = "block";
    const entry = document.createElement("div");
    entry.dataset.logLevel = level;
    entriesContainer.appendChild(entry);
    render(
      html`
        <div style="padding:15px;background:${background};color:${color};">
          ${message}
          <button
            style="color:${color};float:right;margin-left:10px;border:none;background:none;cursor:pointer;font-size:20px;"
            @click=${() => entry.remove()}
          >
            ✕
          </button>
        </div>
      `,
      entry,
    );
  }

  window.addEventListener("error", (event) => {
    const file = event.filename || "";
    if (!file.startsWith(location.origin)) {
      return; // probably browser or extension code
    }
    showMessage(`${event.message} at ${event.filename}:${event.lineno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    showMessage(`Promise rejection: ${String(event.reason)}`);
  });

  const consoleError = console.error;
  console.error = (...args) => {
    showMessage(args.map(formatArg).join(" "));
    consoleError(...args);
  };

  const consoleWarn = console.warn;
  console.warn = (...args) => {
    showMessage(args.map(formatArg).join(" "), "warn");
    consoleWarn(...args);
  };

  window.logMessage = (...args) => {
    showMessage(args.map(formatArg).join(" "));
  };
}
