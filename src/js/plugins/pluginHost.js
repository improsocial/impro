import { EventTarget } from "/js/eventEmitter.js";
import { SimpleUUID, isDev } from "/js/utils.js";

const LOCAL_PLUGINS_INDEX_URL = "/plugins-local/index.json";
const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version"];
const PLUGIN_READY_TIMEOUT_MS = 5000;

const WORKER_PREFIX = `
delete self.BroadcastChannel;
delete self.SharedWorker;
`;

const SANDBOX_URL = "/js/plugins/sandbox.html";
const SANDBOX_READY_TIMEOUT_MS = 5000;

async function fetchPluginIndex() {
  const response = await fetch(LOCAL_PLUGINS_INDEX_URL);
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
  constructor(pluginId, host, worker) {
    this.pluginId = pluginId;
    this.worker = worker;
    this.host = host;
    this.disposers = [];
    this._pendingCalls = new Map();
    this.callUuid = new SimpleUUID();
    this.worker.addEventListener("message", (event) =>
      this._handleWorkerMessage(event),
    );
    this.worker.addEventListener("error", (event) =>
      logger.error(`"${this.pluginId}" worker error:`, event.message),
    );
  }

  _handleWorkerMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    switch (message.type) {
      case "register": {
        const dispose = this.host.handleRegister(this, message);
        if (dispose) this.disposers.push(dispose);
        return;
      }
      case "result": {
        this._handleCallResult(message);
        return;
      }
      case "hostCall": {
        this.host.handleHostCall(this.pluginId, message);
        return;
      }
      default:
        return;
    }
  }

  static async load(pluginId, host, source) {
    const worker = await createSandboxedWorker(WORKER_PREFIX + source);
    const instance = new PluginInstance(pluginId, host, worker);
    return instance;
  }

  async call(handlerId, args) {
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
  constructor({ verbose = false } = {}) {
    this.registries = {
      sidebarItems: new Set(),
      postContextMenuItems: new Set(),
    };
    this._loadedPlugins = new Map();
    this._hostCallHandlers = new Map();
    this._handlePluginNodeEvent = this._handlePluginNodeEvent.bind(this);
    window.addEventListener("plugin-node-event", (e) =>
      this._handlePluginNodeEvent(e),
    );
  }

  async loadPlugins(pluginIds) {
    let availablePlugins;
    try {
      availablePlugins = await fetchPluginIndex();
    } catch {
      availablePlugins = [];
    }
    logger.info(
      `discovered ${availablePlugins.length} plugin(s):`,
      availablePlugins,
    );
    const toLoad = availablePlugins.filter((id) => pluginIds.includes(id));
    if (pluginIds) {
      const skipped = availablePlugins.filter((id) => !pluginIds.includes(id));
      if (skipped.length) logger.info("skipping disabled plugin(s):", skipped);
    }
    await Promise.all(toLoad.map((id) => this._loadPlugin(id)));
  }

  async _loadPlugin(pluginId) {
    if (this._loadedPlugins.has(pluginId)) return;
    let manifest;
    try {
      manifest = await fetchPluginManifest(pluginId);
    } catch (error) {
      logger.warn(`"${pluginId}" invalid manifest:`, error.message);
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
      const pluginInstance = await PluginInstance.load(pluginId, this, source);
      this._loadedPlugins.set(pluginId, pluginInstance);
      logger.info(`loaded "${pluginId}" v${manifest.version}`);
    } catch (error) {
      logger.error(`"${pluginId}" failed during onload:`, error.message);
    }
  }

  registerHostCall(method, handler) {
    this._hostCallHandlers.set(method, handler);
    return () => this._hostCallHandlers.delete(method);
  }

  handleHostCall(pluginId, message) {
    const handler = this._hostCallHandlers.get(message.method);
    if (!handler) {
      logger.warn(
        `"${pluginId}" called unknown host method "${message.method}"`,
      );
      return;
    }
    try {
      handler({ pluginId, args: message.args ?? [] });
    } catch (error) {
      logger.error(
        `"${pluginId}" host method "${message.method}" threw:`,
        error,
      );
    }
  }

  _handlePluginNodeEvent(event) {
    const { pluginId, handlerId } = event.detail;
    this.callPlugin(pluginId, handlerId).catch((error) => {
      logger.warn(`[plugins] "${pluginId}" event handler threw:`, error);
    });
  }

  callPlugin(pluginId, handlerId) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) return;
    return instance.call(handlerId, []);
  }

  sendNotification(pluginId, notificationType, eventData = {}) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) return;
    instance.worker.postMessage({
      type: "notification",
      notificationType,
      ...eventData,
    });
  }

  handleRegister(pluginInstance, message) {
    switch (message.target) {
      case "sidebarItem": {
        const entry = {
          pluginId: pluginInstance.pluginId,
          icon: message.icon,
          title: message.title,
          invoke: () => pluginInstance.call(message.handlerId, []),
        };
        this.registries.sidebarItems.add(entry);
        return () => this.registries.sidebarItems.delete(entry);
      }
      case "postContextMenuItem": {
        const entry = {
          pluginId: pluginInstance.pluginId,
          icon: message.icon,
          title: message.title,
          invoke: (post) => pluginInstance.call(message.handlerId, [post]),
        };
        this.registries.postContextMenuItems.add(entry);
        return () => this.registries.postContextMenuItems.delete(entry);
      }
      default:
        logger.warn(
          `"${pluginInstance.pluginId}" attempted to register unknown target "${message.target}"`,
        );
        return null;
    }
  }

  unloadPlugin(pluginId) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) return;
    instance.unload();
    this._loadedPlugins.delete(pluginId);
  }
}
