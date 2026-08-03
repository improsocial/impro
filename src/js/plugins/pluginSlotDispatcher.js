import { SignalMap } from "/js/signals.js";
import {
  AsyncValueCache,
  batchPerTick,
  BoundedMap,
  isDev,
  SimpleUUID,
  WindowedCounter,
} from "/js/utils.js";

// Rendered content cached per cacheKey-declaring registration
const MAX_CACHED_VALUES = 200;
// Contexts remembered per (plugin, slot), for keyed refresh targeting
const MAX_TRACKED_CONTEXTS = 600;

// Slot contexts are flat string maps (element attributes), so sorting the
// fields is enough to make the serialization stable.
function serializeFields(context) {
  return JSON.stringify(
    Object.keys(context)
      .sort()
      .map((field) => [field, context[field]]),
  );
}

function deserializeFields(serialized) {
  return Object.fromEntries(JSON.parse(serialized));
}

// Subset match: a context matches when every field of some matcher equals the
// context's field of that name
function matchesKeys(keys, context) {
  return keys.some((matcher) =>
    Object.entries(matcher).every(([field, value]) => context[field] === value),
  );
}

function createSlotId(pluginId, name) {
  return JSON.stringify([pluginId, name]);
}

// The context reduced to a registration's declared cacheKey fields - the only
// thing its output is allowed to depend on, and so what its content is cached
// and invalidated by
function projectContext(context, cacheKey) {
  const projection = {};
  for (const field of cacheKey) {
    if (context[field] !== undefined) projection[field] = context[field];
  }
  return projection;
}

// Shared across registrations so a re-registered slot never reuses a version
// a mounted element may still be holding
const versionUuid = new SimpleUUID();

// Tracks plugin-slot version per context to enable targeted re-renders
class SlotVersions {
  constructor() {
    this._base = versionUuid.create();
    // contextKey -> { context, version }: forgetting one would mean a later
    // keyed refresh missing an instance that's still mounted, so an eviction
    // downgrades the next refresh to "invalidate everything"
    this._contexts = new BoundedMap(MAX_TRACKED_CONTEXTS, {
      policy: "lru",
      onEvict: () => {
        this._truncated = true;
      },
    });
    this._truncated = false;
  }

  lookup(context) {
    const contextKey = serializeFields(context);
    const known = this._contexts.get(contextKey);
    if (known) return known.version;
    this._contexts.set(contextKey, { context, version: this._base });
    return this._base;
  }

  invalidate(keys) {
    if (!keys || this._truncated) {
      this._base = versionUuid.create();
      this._contexts.clear();
      this._truncated = false;
      return;
    }
    for (const tracked of this._contexts.values()) {
      if (matchesKeys(keys, tracked.context)) {
        tracked.version = versionUuid.create();
      }
    }
  }
}

// e.g. [{ did: "..." }, ...]
// Returns the matchers, or null when every context should match.
// Throws when the plugin passed something unusable.
function validateRefreshKeys(keys, { pluginId, name, cacheKey }) {
  if (keys == null) return null;
  const fail = (reason) => {
    throw new Error(
      `Plugin "${pluginId}" called refreshSlot("${name}") with invalid keys: ${reason}`,
    );
  };
  if (!Array.isArray(keys)) fail("keys must be an array of objects");
  if (keys.length === 0) fail("keys must not be empty");
  for (const matcher of keys) {
    if (!matcher || typeof matcher !== "object" || Array.isArray(matcher)) {
      fail("each key must be an object");
    }
    const fields = Object.keys(matcher);
    if (fields.length === 0) {
      fail("empty matchers are not allowed; omit keys to match all");
    }
    if (fields.some((field) => typeof matcher[field] !== "string")) {
      fail("matcher values must be strings");
    }
    // A cacheKey declares the only fields the output may depend on, so
    // matching on anything else can't mean what the plugin thinks it does
    if (cacheKey === null) continue;
    if (cacheKey.length === 0) {
      fail(
        "this slot declares an empty cacheKey, so its content depends on no context; omit keys to refresh it",
      );
    }
    const undeclared = fields.filter((field) => !cacheKey.includes(field));
    if (undeclared.length > 0) {
      fail(
        `this slot declares cacheKey (${cacheKey.join(", ")}), so keys can't match on ${undeclared.join(", ")}`,
      );
    }
  }
  return keys;
}

// A batching plugin answers with `{ value } | { error }` per payload -
// validate length and convert to the value-or-Error
function batchedInvoke(pluginId, invoke) {
  return async (payloads) => {
    const results = await invoke(payloads);
    // Results are matched positionally, so a short array can't be attributed
    if (!Array.isArray(results) || results.length !== payloads.length) {
      throw new Error(
        `Plugin "${pluginId}" returned a malformed slot batch result`,
      );
    }
    return results.map((result) => {
      if (result?.error == null) return result?.value ?? null;
      return result.error instanceof Error
        ? result.error
        : new Error(result.error);
    });
  };
}

function invocationAdvice(cacheKey) {
  if (cacheKey === null) {
    return "Declare a cacheKey so instances sharing a projection share one invocation.";
  }
  if (cacheKey.length === 0) {
    return "Its empty cacheKey means one cached entry serves every instance, so something is invalidating it repeatedly.";
  }
  return `Its cacheKey (${cacheKey.join(", ")}) may be too specific to share results.`;
}

const INVOCATION_WINDOW_MS = 5000;
const TOTAL_INVOCATION_LIMIT = 100;

// Warns when a slot handler runs too often in a given window
export class SlotInvocationMonitor {
  constructor() {
    this._counter = new WindowedCounter({
      windowMs: INVOCATION_WINDOW_MS,
      limit: TOTAL_INVOCATION_LIMIT,
    });
  }

  record(registration, name, context) {
    const id = createSlotId(registration.pluginId, name);
    const exceeded = this._counter.record(id, serializeFields(context));
    if (!exceeded) return;
    const seconds = INVOCATION_WINDOW_MS / 1000;
    const advice = invocationAdvice(registration.cacheKey);
    console.warn(
      `[plugins] "${registration.pluginId}" slot "${name}" ran ${exceeded.total} times in ${seconds}s across ${exceeded.distinct} contexts. ${advice}`,
    );
  }
}

export class PluginSlotDispatcher {
  constructor({ monitor = isDev() ? new SlotInvocationMonitor() : null } = {}) {
    this.$slots = new SignalMap();
    // [pluginId, name] -> AsyncValueCache of rendered content by projection
    this._caches = new Map();
    // [pluginId, name] -> SlotVersions
    this._versions = new Map();
    // [pluginId, name] -> (payload) => rendered tree
    this._handlers = new Map();
    this._monitor = monitor;
  }

  register({ pluginId, name, cacheKey = null, batch = false, invoke }) {
    const current = this.$slots.get(name) ?? [];
    if (current.some((other) => other.pluginId === pluginId)) {
      console.warn(
        `"${pluginId}" is already registered for slot "${name}"; ignoring duplicate registration`,
      );
      return null;
    }
    const fields = Array.isArray(cacheKey)
      ? cacheKey.filter((field) => typeof field === "string")
      : null;
    // Batching plugins get their calls coalesced per tick into one worker message;
    // plugins on an older SDK take one payload per call, so their invoke is already this.
    this._handlers.set(
      createSlotId(pluginId, name),
      batch ? batchPerTick(batchedInvoke(pluginId, invoke)) : invoke,
    );
    const versions = this._getSlotVersions(pluginId, name);
    const registration = {
      pluginId,
      cacheKey: fields,
      versionFor: (context) => versions.lookup(context),
      contextKeyFor: (context) =>
        serializeFields(
          fields === null ? context : projectContext(context, fields),
        ),
      request: (context) => this._request(registration, name, context),
    };
    this.$slots.set(name, [...current, registration]);
    return () => {
      const id = createSlotId(pluginId, name);
      this._caches.delete(id);
      this._versions.delete(id);
      this._handlers.delete(id);
      const list = this.$slots.get(name);
      if (!list) return;
      const next = list.filter((other) => other.pluginId !== pluginId);
      if (next.length === 0) {
        this.$slots.delete(name);
      } else {
        this.$slots.set(name, next);
      }
    };
  }

  getRegistrations(name) {
    return [...(this.$slots.get(name) ?? [])];
  }

  // Drops the calling plugin's cached content for the slot, matching on keys
  refresh(pluginId, name, keys) {
    const current = this.$slots.get(name);
    if (!current) return;
    const registration = current.find(
      (candidate) => candidate.pluginId === pluginId,
    );
    if (!registration) return;
    let matchers = null;
    try {
      matchers = validateRefreshKeys(keys, {
        pluginId,
        name,
        cacheKey: registration.cacheKey,
      });
    } catch (error) {
      console.warn(error.message);
      return;
    }
    const matchesProjection =
      matchers &&
      ((projectionKey) =>
        matchesKeys(matchers, deserializeFields(projectionKey)));
    const contentCache = this._caches.get(createSlotId(pluginId, name));
    if (contentCache) {
      contentCache.invalidate(matchesProjection);
    }
    const versions = this._getSlotVersions(pluginId, name);
    versions.invalidate(matchers);
    // Re-emit so mounted slots reconcile; which of them re-invoke is decided
    // by the versions above
    this.$slots.set(name, [...current]);
  }

  // The rendered tree for this context, or a promise of it
  _request(registration, name, context) {
    if (registration.cacheKey === null) {
      return this._getSlotContent(registration, name, context);
    }
    const projection = projectContext(context, registration.cacheKey);
    const contentCache = this._getSlotContentCache(registration, name);
    // Get fresh or cached slot content, keyed by cache keys
    return contentCache.request(serializeFields(projection), () =>
      this._getSlotContent(registration, name, projection),
    );
  }

  _getSlotVersions(pluginId, name) {
    const id = createSlotId(pluginId, name);
    let versions = this._versions.get(id);
    if (!versions) {
      versions = new SlotVersions();
      this._versions.set(id, versions);
    }
    return versions;
  }

  _getSlotContentCache(registration, name) {
    const id = createSlotId(registration.pluginId, name);
    let cache = this._caches.get(id);
    if (!cache) {
      cache = new AsyncValueCache(MAX_CACHED_VALUES);
      this._caches.set(id, cache);
    }
    return cache;
  }

  _getSlotContent(registration, name, payload) {
    if (this._monitor) {
      this._monitor.record(registration, name, payload);
    }
    return this._handlers.get(createSlotId(registration.pluginId, name))(
      payload,
    );
  }
}
