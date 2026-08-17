// JSON-RPC-style wrapper for BroadcastChannel
class RpcChannel {
  #name;
  #channel;
  #handlers = new Map();
  #requestTimeoutMs;

  constructor(channel, { requestTimeoutMs }) {
    this.#name = channel.name;
    this.#requestTimeoutMs = requestTimeoutMs;
    this.#channel = channel;
    channel.addEventListener("message", (event) => this.#handleRequest(event));
  }

  onRequest(method, handler) {
    this.#handlers.set(method, handler);
  }

  // Resolves with the first result another tab returns, or null if none does.
  request(method, params = null) {
    const channel = this.#channel;
    if (!channel) return Promise.resolve(null); // closed
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const onMessage = (event) => {
        if (event.data?.id !== id) return;
        cleanup();
        resolve(event.data.result);
      };
      const cleanup = () => {
        clearTimeout(timer);
        channel.removeEventListener("message", onMessage);
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, this.#requestTimeoutMs);
      channel.addEventListener("message", onMessage);
      channel.postMessage({ method, params, id });
    });
  }

  close() {
    this.#channel?.close();
    this.#channel = null;
    this.#handlers.clear();
  }

  async #handleRequest(event) {
    const { method, params = null, id = null } = event.data ?? {};
    const handler = this.#handlers.get(method);
    if (!handler) return;
    let result = null;
    try {
      result = await handler(params);
    } catch (error) {
      console.error(`[rpc:${this.#name}] ${method} handler failed`, error);
      return;
    }
    // Every tab receives every request, so null means "no response"
    if (id === null || result === null) return;
    this.#channel?.postMessage({ id, result });
  }
}

const CHANNEL_NAME = "active-tab-monitor";
const REPLY_TIMEOUT_MS = 100;

function isThisTabFocused() {
  return document.visibilityState === "visible" && document.hasFocus();
}

// Queries for active tabs over a broadcast channel. Every tab starts one and
// answers the others' queries, so it runs whether or not this tab reads it.
export function startActiveTabMonitor({
  replyTimeoutMs = REPLY_TIMEOUT_MS,
} = {}) {
  if (typeof BroadcastChannel === "undefined") {
    console.warn("[activeTabMonitor] BroadcastChannel unavailable");
    return {
      async isAnyTabActive() {
        return isThisTabFocused();
      },
      stop() {},
    };
  }

  const rpc = new RpcChannel(new BroadcastChannel(CHANNEL_NAME), {
    requestTimeoutMs: replyTimeoutMs,
  });

  rpc.onRequest("isTabActive", () => isThisTabFocused() || null);

  return {
    async isAnyTabActive() {
      if (isThisTabFocused()) return true;
      const res = await rpc.request("isTabActive");
      return res === true;
    },

    stop() {
      rpc.close();
    },
  };
}
