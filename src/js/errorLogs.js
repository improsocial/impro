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

  window.addEventListener("error", (e) => {
    errorLog.style.display = "block";
    const errorDiv = document.createElement("div");
    errorDiv.style.padding = "15px";
    errorDiv.innerHTML = `${e.message} at <br>${e.filename}:${e.lineno} <button style="color:white;float:right;margin-left:10px;border:none;background:none;cursor:pointer;" onclick="this.parentNode.remove()">✕</button>`;
    errorLog.appendChild(errorDiv);
  });
  window.addEventListener("unhandledrejection", (e) => {
    errorLog.style.display = "block";
    const rejectDiv = document.createElement("div");
    rejectDiv.style.padding = "15px";
    rejectDiv.innerHTML = `Promise rejection: ${e.reason} <button style="color:white;float:right;margin-left:10px;border:none;background:none;cursor:pointer;" onclick="this.parentNode.remove()">✕</button>`;
    errorLog.appendChild(rejectDiv);
  });

  const consoleError = console.error;
  console.error = (...args) => {
    errorLog.style.display = "block";
    const errorDiv = document.createElement("div");
    errorDiv.style.padding = "15px";
    errorDiv.innerHTML = `${args.join(
      " "
    )} <button style="color:white;float:right;margin-left:10px;border:none;background:none;cursor:pointer;" onclick="this.parentNode.remove()">✕</button>`;
    errorLog.appendChild(errorDiv);
    consoleError(...args);
  };
}
