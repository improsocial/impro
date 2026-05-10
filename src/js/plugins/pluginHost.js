import { EventTarget } from "/js/eventEmitter.js";
import { SimpleUUID, isDev } from "/js/utils.js";

const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version"];

const WORKER_PREFIX = `
delete self.BroadcastChannel;
delete self.SharedWorker;
`;

const SANDBOX_URL = "/js/plugins/sandbox.html";

async function fetchPluginIndex(indexUrl) {
  const response = await fetch(indexUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.ids) ? body.ids : [];
}

async function fetchPluginSource(id) {
  const response = await fetch(`/plugins-local/${id}/main.js`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

async function fetchPluginManifest(id) {
  const response = await fetch(`/plugins-local/${id}/manifest.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parsePluginManifest(id, await response.json());
}

function parsePluginManifest(pluginId, manifest) {
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (typeof manifest[field] !== "string") {
      throw new Error(`missing required field "${field}"`);
    }
  }
  if (manifest.id !== pluginId) {
    throw new Error(
      `manifest id "${manifest.id}" does not match directory name`,
    );
  }
  return manifest;
}

class Logger {
  static LEVELS = { info: 10, warn: 20, error: 30, silent: 40 };

  constructor(prefix, logLevel = "warn") {
    this.prefix = prefix;
    this.logLevel = logLevel;
  }
  _enabled(level) {
    return Logger.LEVELS[level] >= Logger.LEVELS[this.logLevel];
  }
  info(...args) {
    if (this._enabled("info")) console.info(this.prefix, ...args);
  }
  warn(...args) {
    if (this._enabled("warn")) console.warn(this.prefix, ...args);
  }
  error(...args) {
    if (this._enabled("error")) console.error(this.prefix, ...args);
  }
}

const logger = new Logger("[plugins]", isDev() ? "info" : "warn");

// Has same API as Worker, but runs code in a sandboxed iframe
class SandboxedWorker extends EventTarget {
  constructor(source) {
    super();
    this.source = source;
    this.frame = this._createSandboxFrame();
    this._messageTarget = this.frame.contentWindow;
    this._handleWindowMessage = this._handleWindowMessage.bind(this);
    window.addEventListener("message", this._handleWindowMessage);
    this.frame.addEventListener("load", () => {
      this.frame.contentWindow.postMessage({ type: "init", source }, "*");
    });
    document.body.appendChild(this.frame);
  }

  _createSandboxFrame() {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.display = "none";
    frame.src = SANDBOX_URL;
    return frame;
  }

  postMessage(payload) {
    this.frame.contentWindow.postMessage({ type: "send", payload }, "*");
  }

  terminate() {
    window.removeEventListener("message", this._handleWindowMessage);
    this.frame.remove();
    this.dispatchEvent({ type: "terminate" });
  }

  _handleWindowMessage(event) {
    if (event.source !== this.frame.contentWindow) return;
    const message = event.data;
    if (!message || typeof message !== "object") return;
    switch (message.type) {
      case "fromWorker":
        this.dispatchEvent({ type: "message", data: message.payload });
        return;
      case "workerError":
        this.dispatchEvent({ type: "error", message: message.error });
        return;
    }
  }
}

async function createSandboxedWorker(source) {
  const worker = new SandboxedWorker(source);
  // in the future, we could add a handshake here to ensure worker has loaded
  return worker;
}

class PluginInstance {
  constructor(pluginId, worker, { onRegister, onHostCall }) {
    this.pluginId = pluginId;
    this.worker = worker;
    this._onRegister = onRegister;
    this._onHostCall = onHostCall;
    this.disposers = [];
    this._pendingCalls = new Map();
    this.callUuid = new SimpleUUID();
    this.worker.addEventListener("message", (event) =>
      this._handleWorkerMessage(event),
    );
    this.worker.addEventListener("error", (event) =>
      logger.error(`"${this.pluginId}" worker error:`, event.message),
    );
    this._readyPromise = new Promise((resolve) => {
      this._setReady = () => resolve();
    });
  }

  _handleWorkerMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    switch (message.type) {
      case "ready": {
        this._setReady();
        return;
      }
      case "register": {
        const dispose = this._onRegister(this, message);
        if (dispose) this.disposers.push(dispose);
        return;
      }
      case "result": {
        this._handleCallResult(message);
        return;
      }
      case "hostCall": {
        this._onHostCall(this, message);
        return;
      }
      default:
        return;
    }
  }

  static async loadFromSource(pluginId, source, callbacks) {
    const worker = await createSandboxedWorker(WORKER_PREFIX + source);
    const instance = new PluginInstance(pluginId, worker, callbacks);
    return instance.waitForReady();
  }

  async waitForReady() {
    await this._readyPromise;
    return this;
  }

  async call(handlerId, ...args) {
    const callId = this.callUuid.create();
    return new Promise((resolve, reject) => {
      this._pendingCalls.set(callId, { resolve, reject });
      this.worker.postMessage({
        type: "call",
        callId,
        handlerId,
        args,
      });
    });
  }

  async sendEvent(event, data) {
    this.worker.postMessage({
      type: "event",
      event,
      data,
    });
  }

  _handleCallResult(message) {
    const pending = this._pendingCalls.get(message.callId);
    if (!pending) return;
    this._pendingCalls.delete(message.callId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
  }

  unload() {
    this.disposers.forEach((dispose) => dispose());
    this.worker.terminate();
  }
}

export class PluginHost {
  constructor() {
    this._availablePlugins = null;
    this._registrationTargets = new Map();
    this._loadedPlugins = new Map();
    this._hostCallHandlers = new Map();
  }

  addRegistrationTarget(target, handler) {
    this._registrationTargets.set(target, handler);
  }

  _handleRegistration(pluginInstance, message) {
    const handler = this._registrationTargets.get(message.target);
    if (!handler) {
      logger.warn(
        `"${pluginInstance.pluginId}" attempted to register unknown target "${message.target}"`,
      );
      return null;
    }

    return handler(pluginInstance, message);
  }

  async loadPluginIndex(indexUrl) {
    try {
      this._availablePlugins = await fetchPluginIndex(indexUrl);
      logger.info(
        `discovered ${this._availablePlugins.length} plugin(s):`,
        this._availablePlugins,
      );
    } catch (error) {
      throw new Error(`failed to load plugin index: ${error.message}`);
    }
  }

  async loadPlugins(pluginIds) {
    if (this._availablePlugins === null) {
      logger.info("Plugin index not loaded");
      return;
    }
    const toLoad = [];
    for (const pluginId of pluginIds) {
      if (!this._availablePlugins.includes(pluginId)) {
        logger.warn("skipping unregistered plugin:", pluginId);
        continue;
      }
      toLoad.push(pluginId);
    }
    await Promise.all(toLoad.map((id) => this.loadPlugin(id)));
  }

  async loadPlugin(pluginId) {
    if (this._loadedPlugins.has(pluginId)) return;
    let manifest;
    try {
      manifest = await fetchPluginManifest(pluginId);
    } catch (error) {
      logger.warn(
        `failed to load "${pluginId}": invalid manifest:`,
        error.message,
      );
      return;
    }
    let source;
    try {
      source = await fetchPluginSource(pluginId);
    } catch (error) {
      logger.error(
        `failed to load "${pluginId}": could not fetch main.js`,
        error,
      );
      return;
    }
    try {
      const pluginInstance = await PluginInstance.loadFromSource(
        pluginId,
        source,
        {
          onRegister: (instance, message) =>
            this._handleRegistration(instance, message),
          onHostCall: (instance, message) =>
            this._handleHostCall(instance, message),
        },
      );
      this._loadedPlugins.set(pluginId, pluginInstance);
      logger.info(`loaded "${pluginId}" v${manifest.version}`);
    } catch (error) {
      logger.error(`"${pluginId}" failed during initialize:`, error.message);
    }
  }

  addHostMethod(method, handler) {
    this._hostCallHandlers.set(method, handler);
  }

  _handleHostCall(pluginInstance, message) {
    const handler = this._hostCallHandlers.get(message.method);
    if (!handler) {
      logger.warn(
        `"${pluginInstance.pluginId}" called unknown host method "${message.method}"`,
      );
      return;
    }
    const args = message.args ?? [];
    try {
      handler(pluginInstance, ...args);
    } catch (error) {
      logger.error(
        `"${pluginInstance.pluginId}" host method "${message.method}" threw:`,
        error,
      );
    }
  }

  handleNodeEvent(pluginId, handlerId, virtualEvent) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) {
      logger.warn(
        `received event for unknown plugin "${pluginId}", handler "${handlerId}"`,
      );
      return;
    }
    instance.call(handlerId, virtualEvent).catch((error) => {
      logger.warn(`[plugins] "${pluginId}" event handler threw:`, error);
    });
  }

  unloadPlugin(pluginId) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) return;
    instance.unload();
    this._loadedPlugins.delete(pluginId);
  }
}
