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

class WorkerSandbox {
  constructor(id) {
    this.id = id;
    this.frame = this._createSandboxFrame();
    this.worker = null;
  }

  _createSandboxFrame() {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", `worker sandbox: ${this.id}`);
    frame.style.display = "none";
    frame.src = SANDBOX_URL;
    return frame;
  }

  _destroy() {
    this.frame.remove();
  }

  async load(source, timeoutMs = SANDBOX_READY_TIMEOUT_MS) {
    const ready = new Promise((resolve, reject) => {
      const onMessage = (event) => {
        if (event.source !== this.frame.contentWindow) return;
        if (event.data?.type !== "ready") return;
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve();
      };
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("sandbox iframe did not become ready"));
      }, timeoutMs);
      window.addEventListener("message", onMessage);
    });
    this.frame.addEventListener("load", () => {
      this.frame.contentWindow.postMessage({ type: "init", source }, "*");
    });
    document.body.appendChild(this.frame);
    await ready;

    this.worker = new WorkerInterface(this.frame.contentWindow);
    this.worker.addEventListener("terminate", () => this._destroy());
    return this.worker;
  }
}

class PluginInstance {
  constructor(pluginId, worker) {
    this.pluginId = pluginId;
    this.worker = worker;
    this.disposers = [];
  }

  async waitForReady(timeoutMs = PLUGIN_READY_TIMEOUT_MS) {
    const ready = new Promise((resolve, reject) => {
      const cleanup = () => {
        this.worker.removeEventListener("message", messageListener);
        this.worker.removeEventListener("error", errorListener);
      };
      const messageListener = (event) => {
        if (event.data?.type !== "ready") return;
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve();
      };
      const errorListener = (event) => {
        cleanup();
        reject(new Error(event.message));
      };
      this.worker.addEventListener("message", messageListener);
      this.worker.addEventListener("error", errorListener);
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`did not finish loading within ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    return Promise.race([ready, timeout]);
  }
}

export class PluginHost {
  constructor({ verbose = false } = {}) {
    this.registries = {
      mutedWordMatchers: new Set(),
      sidebarIcons: new Set(),
    };

    this.logger = new Logger("[plugins]");
    this._loadedPlugins = new Map(); // id -> PluginInstance

    this._hostCallHandlers = new Map();
    this._pendingPluginCalls = new Map();

    this.uuid = new SimpleUUID();
  }

  async loadEnabledPlugins({ enabledIds } = {}) {
    const availablePlugins = await this._fetchPluginIndex();
    this.logger.info(
      `discovered ${availablePlugins.length} plugin(s):`,
      availablePlugins,
    );
    const toLoad = enabledIds
      ? availablePlugins.filter((id) => enabledIds.includes(id))
      : availablePlugins;
    if (enabledIds) {
      const skipped = availablePlugins.filter((id) => !enabledIds.includes(id));
      if (skipped.length)
        this.logger.info("skipping disabled plugin(s):", skipped);
    }
    await Promise.all(toLoad.map((id) => this._loadPlugin(id)));
  }

  registerHostCall(method, handler) {
    this._hostCallHandlers.set(method, handler);
    return () => this._hostCallHandlers.delete(method);
  }

  async _fetchPluginIndex() {
    try {
      const response = await fetch(LOCAL_PLUGINS_INDEX_URL);
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body.ids) ? body.ids : [];
    } catch {
      return [];
    }
  }

  async _loadPlugin(pluginId) {
    if (this._loadedPlugins.has(pluginId)) return;

    const manifest = await this._fetchManifest(pluginId);
    if (!manifest) {
      this.logger.error(
        `failed to load "${pluginId}": invalid or missing manifest`,
      );
      return;
    }

    const source = await this._fetchSource(pluginId);
    if (!source) {
      this.logger.error(`failed to load "${pluginId}": could not fetch source`);
      return;
    }

    let worker;
    try {
      const sandbox = new WorkerSandbox();
      worker = await sandbox.load(source);
    } catch (error) {
      this.logger.error(
        `failed to load "${pluginId}": could not spawn worker`,
        error,
      );
      return;
    }
    const pluginInstance = new PluginInstance(pluginId, worker);

    worker.addEventListener("message", (event) =>
      this._handleWorkerMessage(pluginInstance, event.data),
    );
    worker.addEventListener("error", (event) =>
      this.logger.error(`"${pluginId}" worker error:`, event.message),
    );

    this._loadedPlugins.set(pluginId, pluginInstance);
    try {
      await pluginInstance.waitForReady();
      this.logger.info(`loaded "${pluginId}" v${manifest.version}`);
    } catch (error) {
      this.logger.error(`"${pluginId}" failed during onload:`, error.message);
    }
  }

  async _fetchSource(id) {
    try {
      const response = await fetch(`/plugins-local/${id}/main.js`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      this.logger.error(
        `failed to load "${id}": could not fetch main.js`,
        error,
      );
      return null;
    }
  }

  async _fetchManifest(id) {
    try {
      const response = await fetch(`/plugins-local/${id}/manifest.json`);
      if (!response.ok) return null;
      return parsePluginManifest(id, await response.json());
    } catch (error) {
      this.logger.warn(`"${id}" invalid manifest:`, error.message);
      return null;
    }
  }

  _handleWorkerMessage(pluginInstance, message) {
    if (!message || typeof message !== "object") return;
    switch (message.type) {
      case "register": {
        const dispose = this._registerFromPlugin(pluginInstance, message);
        if (dispose) pluginInstance.disposers.push(dispose);
        return;
      }
      case "result": {
        this._handleCallResult(message);
        return;
      }
      case "hostCall": {
        this._handleHostCall(pluginInstance.pluginId, message);
        return;
      }
      default:
        return;
    }
  }

  _handleHostCall(pluginId, message) {
    const handler = this._hostCallHandlers.get(message.method);
    if (!handler) {
      this.logger.warn(
        `"${pluginId}" called unknown host method "${message.method}"`,
      );
      return;
    }
    try {
      handler({ pluginId, args: message.args ?? [] });
    } catch (error) {
      this.logger.error(
        `"${pluginId}" host method "${message.method}" threw:`,
        error,
      );
    }
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

  _registerFromPlugin(pluginInstance, message) {
    switch (message.target) {
      // case "mutedWordMatcher": {
      //   const entry = {
      //     pluginId,
      //     match: (text, value) =>
      //       this._callWorker(worker, "mutedWordMatcher", message.handlerId, [
      //         text,
      //         value,
      //       ]),
      //   };
      //   this.registries.mutedWordMatchers.add(entry);
      //   return () => this.registries.mutedWordMatchers.delete(entry);
      // }
      case "sidebarIcon": {
        const entry = {
          pluginId: pluginInstance.pluginId,
          icon: message.icon,
          title: message.title,
          invoke: () =>
            this._callPlugin(
              pluginInstance,
              "sidebarIcon",
              message.handlerId,
              [],
            ),
        };
        this.registries.sidebarIcons.add(entry);
        return () => this.registries.sidebarIcons.delete(entry);
      }
      default:
        this.logger.warn(
          `"${pluginInstance.pluginId}" attempted to register unknown target "${message.target}"`,
        );
        return null;
    }
  }

  _callPlugin(pluginInstance, target, handlerId, args) {
    const callId = this.uuid.create();
    return new Promise((resolve, reject) => {
      this._pendingPluginCalls.set(callId, { resolve, reject });
      pluginInstance.worker.postMessage({
        type: "call",
        callId,
        target,
        handlerId,
        args,
      });
    });
  }

  _handleCallResult(message) {
    const pending = this._pendingPluginCalls.get(message.callId);
    if (!pending) return;
    this._pendingPluginCalls.delete(message.callId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
  }

  unloadPlugin(pluginId) {
    const instance = this._loadedPlugins.get(pluginId);
    if (!instance) return;
    instance.disposers.forEach((dispose) => dispose());
    instance.worker.terminate();
    this._loadedPlugins.delete(pluginId);
  }
}

class WorkerInterface extends EventTarget {
  constructor(messageTarget) {
    super();
    this._messageTarget = messageTarget;
    this._handleWindowMessage = this._handleWindowMessage.bind(this);
    window.addEventListener("message", this._handleWindowMessage);
  }

  postMessage(payload) {
    this._messageTarget.postMessage({ type: "send", payload }, "*");
  }

  terminate() {
    window.removeEventListener("message", this._handleWindowMessage);
    this.dispatchEvent({ type: "terminate" });
  }

  _handleWindowMessage(event) {
    if (event.source !== this._messageTarget) return;
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
