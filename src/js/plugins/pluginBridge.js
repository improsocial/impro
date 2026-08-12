import { EventTarget } from "/js/eventEmitter.js";
import { SimpleUUID, isDev } from "/js/utils.js";
import { SignalMap, ComputedMap } from "/js/signals.js";

const SANDBOX_URL = "/plugin-sandbox.html";

export class Logger {
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
export class SandboxedWorker extends EventTarget {
  constructor(wrappedSource) {
    super();
    this.frame = this._createSandboxFrame();
    this._messageTarget = this.frame.contentWindow;
    this._handleWindowMessage = this._handleWindowMessage.bind(this);
    window.addEventListener("message", this._handleWindowMessage);
    this.frame.addEventListener("load", () => {
      this.frame.contentWindow.postMessage(
        { type: "init", workerSource: wrappedSource },
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

export class PluginSdkError extends Error {}

let __sdkSourcePromise = null;

function getSdkSource() {
  if (__sdkSourcePromise == null) {
    __sdkSourcePromise = fetch(`/plugin-sdk/${window.env.pluginSdkFileName}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .catch((error) => {
        __sdkSourcePromise = null;
        throw new PluginSdkError(
          `Could not fetch plugin SDK: ${error.message}`,
        );
      });
  }
  return __sdkSourcePromise;
}

// A plugin's manifest.executables table is the only thing that can make
// WebAssembly.instantiate/compile succeed inside the worker (see
// wasmGatePrelude below) — everything not listed there is refused. This
// runs before the plugin's own main.js text, so it's trusted, host-authored
// code even though it executes inside the plugin's worker.
function wasmGatePrelude(executables) {
  const declared = JSON.stringify(
    (executables ?? []).map((entry) => entry.sha256),
  );
  return /* js */ `
    (() => {
      const declaredHashes = new Set(${declared});

      // Pure-JS SHA-256 (FIPS 180-4) rather than crypto.subtle.digest():
      // this worker's document has sandbox="allow-scripts" with no
      // allow-same-origin, which gives it an opaque origin - and per spec,
      // an opaque origin is never a secure context, so crypto.subtle is
      // unavailable here in browsers that enforce that strictly (confirmed
      // in Chrome: self.isSecureContext is false and self.crypto.subtle is
      // undefined inside this exact sandboxed worker). Implementing the
      // hash in plain JS sidesteps the secure-context requirement entirely
      // without loosening the sandbox itself.
      const SHA256_K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
        0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
        0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
        0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
        0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
        0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
        0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
        0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
      ]);

      function sha256Rotr(x, n) {
        return ((x >>> n) | (x << (32 - n))) >>> 0;
      }

      async function sha256Hex(bytesLike) {
        const bytes =
          bytesLike instanceof ArrayBuffer
            ? new Uint8Array(bytesLike)
            : new Uint8Array(
                bytesLike.buffer,
                bytesLike.byteOffset,
                bytesLike.byteLength,
              );

        const bitLen = bytes.length * 8;
        // 1 byte for 0x80, 8 bytes for the 64-bit big-endian length,
        // padded so the total is a multiple of 64.
        const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLen);
        padded.set(bytes);
        padded[bytes.length] = 0x80;
        const view = new DataView(padded.buffer);
        // bitLen fits in 32 bits for any bytes this gate will ever see
        // (well under 2^32 bits = 512MiB), so the high 32 bits of the
        // 64-bit length are always zero.
        view.setUint32(paddedLen - 4, bitLen >>> 0, false);

        let h0 = 0x6a09e667,
          h1 = 0xbb67ae85,
          h2 = 0x3c6ef372,
          h3 = 0xa54ff53a,
          h4 = 0x510e527f,
          h5 = 0x9b05688c,
          h6 = 0x1f83d9ab,
          h7 = 0x5be0cd19;

        const w = new Uint32Array(64);
        for (let offset = 0; offset < paddedLen; offset += 64) {
          for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(offset + i * 4, false);
          }
          for (let i = 16; i < 64; i++) {
            const s0 =
              sha256Rotr(w[i - 15], 7) ^
              sha256Rotr(w[i - 15], 18) ^
              (w[i - 15] >>> 3);
            const s1 =
              sha256Rotr(w[i - 2], 17) ^
              sha256Rotr(w[i - 2], 19) ^
              (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
          }

          let a = h0,
            b = h1,
            c = h2,
            d = h3,
            e = h4,
            f = h5,
            g = h6,
            h = h7;

          for (let i = 0; i < 64; i++) {
            const S1 = sha256Rotr(e, 6) ^ sha256Rotr(e, 11) ^ sha256Rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
            const S0 = sha256Rotr(a, 2) ^ sha256Rotr(a, 13) ^ sha256Rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
          }

          h0 = (h0 + a) >>> 0;
          h1 = (h1 + b) >>> 0;
          h2 = (h2 + c) >>> 0;
          h3 = (h3 + d) >>> 0;
          h4 = (h4 + e) >>> 0;
          h5 = (h5 + f) >>> 0;
          h6 = (h6 + g) >>> 0;
          h7 = (h7 + h) >>> 0;
        }

        return [h0, h1, h2, h3, h4, h5, h6, h7]
          .map((x) => x.toString(16).padStart(8, "0"))
          .join("");
      }

      async function assertDeclared(bytesLike) {
        if (
          !(bytesLike instanceof ArrayBuffer) &&
          !ArrayBuffer.isView(bytesLike)
        ) {
          throw new TypeError("WebAssembly bytes must be a BufferSource");
        }
        const hash = await sha256Hex(bytesLike);
        if (!declaredHashes.has(hash)) {
          // Named distinctly (rather than a plain Error) so a plugin can
          // tell "the host's CSP genuinely has no wasm-unsafe-eval" (a
          // native CompileError/SecurityError, thrown before this check
          // ever runs) apart from "wasm-unsafe-eval works fine, this
          // particular byte string just isn't declared" - e.g. for
          // capability-probing with inert bytes that were never meant to be
          // added to the manifest.
          const error = new Error(
            'WebAssembly execution blocked: bytes with sha256 "' +
              hash +
              '" are not declared in this plugin\\'s manifest ' +
              '"executables" list. Add an entry with this hash and a ' +
              "sourceUrl before this code can run.",
          );
          error.name = "WasmProvenanceError";
          throw error;
        }
      }

      // No WebAssembly global at all (e.g. a stripped-down test harness, or
      // a runtime that lacks it entirely) - nothing to gate.
      if (!self.WebAssembly) return;

      // Mutated in place (not replaced with a fresh object) so
      // WebAssembly.Instance/Memory/Table/validate/the error constructors —
      // none of which need gating — stay exactly as the engine provides
      // them, with no risk of an incomplete spread dropping one.
      const wasm = self.WebAssembly;
      const RealModule = wasm.Module; // captured before it's blocked below
      const realCompile = wasm.compile.bind(wasm);
      const realInstantiate = wasm.instantiate.bind(wasm);

      wasm.compile = async (bytesLike) => {
        await assertDeclared(bytesLike);
        return realCompile(bytesLike);
      };
      wasm.instantiate = async (bytesLikeOrModule, importObject) => {
        // A WebAssembly.Module instance can only exist here via the gated
        // compile() above (the synchronous Module constructor is disabled
        // below), so it's already been checked.
        if (bytesLikeOrModule instanceof RealModule) {
          return realInstantiate(bytesLikeOrModule, importObject);
        }
        await assertDeclared(bytesLikeOrModule);
        return realInstantiate(bytesLikeOrModule, importObject);
      };
      // The synchronous Module constructor can't be gated (crypto.subtle is
      // async, constructors can't await), so "new WebAssembly.Module(...)"
      // is blocked outright — legitimate code goes through the gated
      // compile()/instantiate() above instead. instanceof checks against
      // WebAssembly.Module still need to recognize modules that did come
      // from that gated path (e.g. Emscripten glue commonly branches on
      // "x instanceof WebAssembly.Module"), so Symbol.hasInstance is
      // delegated to the real class rather than replacing Module with a
      // constructor nothing will ever be an instance of.
      const BlockedModule = function () {
        throw new Error(
          "new WebAssembly.Module() is disabled in the plugin sandbox; " +
            "use WebAssembly.compile()/instantiate() instead.",
        );
      };
      BlockedModule.prototype = RealModule.prototype;
      Object.defineProperty(BlockedModule, Symbol.hasInstance, {
        value: (instance) => instance instanceof RealModule,
      });
      wasm.Module = BlockedModule;
      // instantiateStreaming/compileStreaming can't produce a valid
      // Response inside this sandbox anyway (connect-src: none blocks a
      // real fetch, and the SDK's own proxied fetch() doesn't return a real
      // Response) — removed outright rather than left as an unguarded path.
      wasm.compileStreaming = undefined;
      wasm.instantiateStreaming = undefined;
    })();
  `;
}

export async function wrapWorkerSource(source, manifest) {
  const sdkSource = await getSdkSource();
  return /* js */ `
    delete self.BroadcastChannel;
    delete self.SharedWorker;

    ${wasmGatePrelude(manifest?.executables)}

    ${sdkSource}

    self.module = {};

    self.require = (name) => {
      if (name === "@impro.social/impro-plugin") return ImproPlugin;
      throw new Error("Cannot find module \\"" + name + "\\"");
    };

    ${source}

    const pluginClass = self.module.exports?.default;
    if (pluginClass) {
      pluginClass.register();
    }
  `;
}

function createSandboxedWorker(wrappedSource) {
  const worker = new SandboxedWorker(wrappedSource);
  // in the future, we could add a handshake here to ensure worker has loaded
  return worker;
}

// Direct (unsandboxed) Worker for e2e tests
function createDirectWorker(wrappedSource) {
  const blob = new Blob([wrappedSource], {
    type: "text/javascript",
  });
  return new Worker(URL.createObjectURL(blob));
}

export class PluginInstance {
  constructor(pluginId, manifest, worker, { onRegister, onHostCall }) {
    this.pluginId = pluginId;
    this.manifest = manifest;
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

  static async loadFromSource(pluginId, manifest, source, callbacks) {
    const wrappedSource = await wrapWorkerSource(source, manifest);
    const worker = !window.env.playwright // don't sandbox in e2e tests
      ? createSandboxedWorker(wrappedSource)
      : createDirectWorker(wrappedSource);
    const instance = new PluginInstance(pluginId, manifest, worker, callbacks);
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
  constructor(
    sourceProvider,
    pluginStylesLoader,
    loadPluginInstance = PluginInstance.loadFromSource,
  ) {
    this._provider = sourceProvider;
    this._pluginStylesLoader = pluginStylesLoader;
    this._loadPluginInstance = loadPluginInstance;
    this._registrationTargets = new Map();
    this._loadedPlugins = new Map();
    this._inFlightLoads = new Map();
    this._hostCallHandlers = new Map();
    // reactive loading state
    this.$loading = new SignalMap();
    this.$pluginLoadingErrors = new SignalMap();
    this.$loadStatuses = new ComputedMap((pluginId) => ({
      loading: this.$loading.get(pluginId) ?? false,
      error: this.$pluginLoadingErrors.get(pluginId) ?? null,
    }));
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

  // Request: {id, version, repo?}
  async loadPlugins(pluginRequests) {
    const loadedPlugins = [];
    const erroredPlugins = [];
    await Promise.all(
      pluginRequests.map(async ({ id, version, repo }) => {
        try {
          const plugin = await this.loadPlugin(id, version, repo);
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

  async loadPlugin(pluginId, version, repo) {
    if (this._loadedPlugins.has(pluginId)) return;
    const inFlightLoad = this._inFlightLoads.get(pluginId);
    if (inFlightLoad) return inFlightLoad;
    const load = (async () => {
      this.$loading.set(pluginId, true);
      this.$pluginLoadingErrors.set(pluginId, null);
      try {
        const instance = await this._loadPlugin(pluginId, version, repo);
        return instance;
      } catch (error) {
        this.$pluginLoadingErrors.set(pluginId, error);
        throw error;
      } finally {
        this.$loading.set(pluginId, false);
        this._inFlightLoads.delete(pluginId);
      }
    })();
    this._inFlightLoads.set(pluginId, load);
    return load;
  }

  async _loadPlugin(pluginId, version, repo) {
    let manifest;
    try {
      manifest = await this._provider.getManifest(pluginId, version, repo);
    } catch (error) {
      logger.warn(`failed to load "${pluginId}": invalid manifest`, error);
      throw new Error("Could not fetch plugin manifest");
    }
    let source;
    try {
      source = await this._provider.getSource(pluginId, version, repo);
    } catch (error) {
      logger.error(
        `failed to load "${pluginId}": could not fetch main.js`,
        error,
      );
      throw new Error("Could not fetch plugin source");
    }
    let cssText;
    try {
      cssText = await this._provider.getStyles(pluginId, version, repo);
    } catch (error) {
      logger.error(
        `failed to load "${pluginId}": could not fetch styles.css`,
        error,
      );
      throw new Error("Failed to load plugin styles");
    }
    if (cssText != null) {
      try {
        this._pluginStylesLoader.mount(pluginId, cssText);
      } catch (error) {
        logger.error(`failed to load "${pluginId}": invalid styles.css`, error);
        throw new Error("Plugin styles failed validation");
      }
    }
    if (manifest.fonts?.length) {
      try {
        const descriptors = await Promise.all(
          manifest.fonts.map(async (font) => ({
            ...font,
            blob: await this._provider.getFont(
              pluginId,
              version,
              repo,
              font.file,
            ),
          })),
        );
        this._pluginStylesLoader.mountFonts(pluginId, descriptors);
      } catch (error) {
        this._pluginStylesLoader.unmount(pluginId);
        logger.error(
          `failed to load "${pluginId}": could not load fonts`,
          error,
        );
        throw new Error("Failed to load plugin fonts");
      }
    }
    try {
      const pluginInstance = await this._loadPluginInstance(
        pluginId,
        manifest,
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
      return pluginInstance;
    } catch (error) {
      this._pluginStylesLoader.unmount(pluginId);
      if (error instanceof PluginSdkError) {
        logger.error(`could not load "${pluginId}": plugin SDK unavailable`);
        throw new Error("Plugin system failed to load");
      }
      logger.error(`"${pluginId}" failed during initialization:`, error);
      throw new Error("Plugin failed during initialization");
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
    this.$loading.delete(pluginId);
    this.$pluginLoadingErrors.delete(pluginId);
    this._pluginStylesLoader.unmount(pluginId);
  }

  async reloadPlugin(pluginId, version, repo) {
    this.unloadPlugin(pluginId);
    return this.loadPlugin(pluginId, version, repo);
  }
}
