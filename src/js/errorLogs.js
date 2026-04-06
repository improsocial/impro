import { html, render } from "/js/lib/lit-html.js";

export function enableErrorLogs() {
  const errorLog = document.createElement("div");
  errorLog.id = "error-log";
  errorLog.style.cssText = `
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(255, 0, 0, 0.9);
  color: white;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999999;
  display: none;
`;
  document.body.appendChild(errorLog);

  const entryStyle = "padding:15px;";
  const buttonStyle =
    "color:white;float:right;margin-left:10px;border:none;background:none;cursor:pointer;";

  function showMessage(message) {
    errorLog.style.display = "block";
    const entry = document.createElement("div");
    errorLog.appendChild(entry);
    render(
      html`
        <div style=${entryStyle}>
          ${message}
          <button style=${buttonStyle} @click=${() => entry.remove()}>✕</button>
        </div>
      `,
      entry,
    );
  }

  window.addEventListener("error", (event) => {
    showMessage(`${event.message} at ${event.filename}:${event.lineno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    showMessage(`Promise rejection: ${String(event.reason)}`);
  });

  const consoleError = console.error;
  console.error = (...args) => {
    showMessage(args.join(" "));
    consoleError(...args);
  };
}
