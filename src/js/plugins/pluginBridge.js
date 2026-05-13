import { EventTarget } from "/js/eventEmitter.js";
import { SimpleUUID, isDev } from "/js/utils.js";

const SANDBOX_URL = "/js/plugins/sandbox.html";

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
      this.frame.contentWindow.postMessage(
        { type: "init", workerSource: wrapWorkerSource(source) },
        "*",
      );
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

export function wrapWorkerSource(source) {
  const prelude = `
    delete self.BroadcastChannel;
    delete self.SharedWorker;
  `;
  return `${prelude}\n${source}`;
}

async function createSandboxedWorker(source) {
  const worker = new SandboxedWorker(source);
  // in the future, we could add a handshake here to ensure worker has loaded
  return worker;
}

// Direct (unsandboxed) Worker for e2e tests
async function createDirectWorker(source) {
  const blob = new Blob([wrapWorkerSource(source)], {
    type: "text/javascript",
  });
  return new Worker(URL.createObjectURL(blob), { type: "module" });
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
    this._readyPromise = new Promise((resolve, reject) => {
      this._setReady = () => resolve();
      this._setFailed = (e) => reject(e);
    });
  }

  _handleWorkerMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    switch (message.type) {
      case "ready": {
        message.error ? this._setFailed(message.error) : this._setReady();
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

  static async loadFromSource(pluginId, source, callbacks, sandbox) {
    const worker = sandbox
      ? await createSandboxedWorker(source)
      : await createDirectWorker(source);
    const instance = new PluginInstance(pluginId, worker, callbacks);
    try {
      return await instance.waitForReady(2000);
    } catch (err) {
      instance.unload();
      throw err;
    }
  }

  async waitForReady(timeout) {
    const timeoutPromise = new Promise((resolve, reject) =>
      setTimeout(() => reject(new Error("Timed out")), timeout),
    );
    await Promise.race([this._readyPromise, timeoutPromise]);
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

export class PluginBridge {
  constructor(sourceProvider, { sandbox = true } = {}) {
    this._provider = sourceProvider;
    this._sandbox = sandbox;
    this._registrationTargets = new Map();
    this._loadedPlugins = new Map();
    this._hostCallHandlers = new Map();
  }

  isLoaded(pluginId) {
    return this._loadedPlugins.has(pluginId);
  }

  getInstance(pluginId) {
    return this._loadedPlugins.get(pluginId) ?? null;
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

  async loadPlugins(pluginRequests) {
    const loadedPlugins = [];
    const erroredPlugins = [];
    await Promise.all(
      pluginRequests.map(async ({ id, version }) => {
        try {
          const plugin = await this.loadPlugin(id, version);
          loadedPlugins.push(plugin);
        } catch (error) {
          erroredPlugins.push({ pluginId: id, version, error });
        }
      }),
    );
    return {
      loadedPlugins,
      erroredPlugins,
    };
  }

  async loadPlugin(pluginId, version) {
    if (this._loadedPlugins.has(pluginId)) return;
    const manifest = await this._provider.ensureManifest(pluginId, version);
    if (!manifest) {
      logger.warn(`failed to load "${pluginId}": invalid manifest`);
      return;
    }
    let source;
    try {
      source = await this._provider.getSource(pluginId, version);
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
        this._sandbox,
      );
      this._loadedPlugins.set(pluginId, pluginInstance);
      logger.info(`loaded "${pluginId}" v${manifest.version}`);
      return pluginInstance;
    } catch (error) {
      logger.error(`"${pluginId}" failed during initialization:`, error);
      throw error;
    }
  }

  addHostMethod(method, handler) {
    this._hostCallHandlers.set(method, handler);
  }

  _handleHostCall(pluginInstance, message) {
    const handler = this._hostCallHandlers.get(message.method);
    const hostCallId = message.hostCallId;
    const sendResult = (result) => {
      if (hostCallId == null) return;
      pluginInstance.worker.postMessage({
        type: "hostResult",
        hostCallId,
        ...result,
      });
    };
    if (!handler) {
      logger.warn(
        `"${pluginInstance.pluginId}" called unknown host method "${message.method}"`,
      );
      sendResult({ error: `unknown host method "${message.method}"` });
      return;
    }
    const args = message.args ?? [];
    Promise.resolve()
      .then(() => handler(pluginInstance, ...args))
      .then(
        (value) => sendResult({ value }),
        (error) => {
          logger.error(
            `"${pluginInstance.pluginId}" host method "${message.method}" threw:`,
            error,
          );
          sendResult({ error: error?.message ?? String(error) });
        },
      );
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

  async reloadPlugin(pluginId, version) {
    this.unloadPlugin(pluginId);
    return this.loadPlugin(pluginId, version);
  }
}
