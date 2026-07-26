import { PluginBridge } from "/js/plugins/pluginBridge.js";
import {
  showPluginModal,
  hidePluginModal,
  showPluginInstallPermissionsModal,
  showPluginUpdatePermissionsModal,
} from "/js/plugins/pluginModal.js";
import { showPluginToast, hidePluginToast, showToast } from "/js/toasts.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";
import {
  RemotePluginRegistry,
  LocalPluginRegistry,
} from "/js/plugins/pluginRegistry.js";
import { PluginCache } from "/js/plugins/pluginCache.js";
import {
  getLocalData,
  setLocalData,
  clearLocalData,
} from "/js/plugins/pluginLocalDataStore.js";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";
import { SourceProvider } from "/js/plugins/sourceProvider.js";
import { PluginStylesLoader } from "/js/plugins/pluginStylesLoader.js";
import { pluginFetch } from "/js/plugins/pluginRequests.js";
import { Slingshot, isValidRkey } from "/js/slingshot.js";
import {
  getPermissionsFromManifest,
  diffPermissions,
  isEmptyPermissions,
  isActionAllowed,
  isRecordWriteAllowed,
  SHARED_PLUGIN_RECORDS_COLLECTION,
} from "/js/plugins/pluginPermissions.js";
import { compareVersions, groupBy, isDev, sortBy } from "/js/utils.js";
import {
  validateRichTextTokens,
  hydrateRichTextFacets,
} from "/js/richTextHelpers.js";
import { Signal, SignalMap, SignalSet, ReactiveStore } from "/js/signals.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { PLUGIN_REGISTRY_URL } from "/js/config.js";
import { getFeedGeneratorProxyUrl } from "/js/dataHelpers.js";

const DISABLE_PLUGINS_QUERY_PARAM = "disable-plugins";

function requireHostMethodArg(method, name, value) {
  if (!value) {
    throw new Error(`${method} requires a ${name}`);
  }
}

export const PLUGIN_PREVIEW_QUERY_PARAM = "plugin-preview";

export function arePluginsDisabledByQueryParam() {
  const params = new URLSearchParams(window.location.search);
  return params.has(DISABLE_PLUGINS_QUERY_PARAM);
}

export function getPluginPreviewIdsFromQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const values = params.getAll(PLUGIN_PREVIEW_QUERY_PARAM);
  const ids = values
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

const REPO_URL_HOSTS = {
  "github.com": "github",
  "www.github.com": "github",
  "tangled.org": "tangled",
  "www.tangled.org": "tangled",
  "tangled.sh": "tangled",
};

export function parseRepoUrl(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  const host = REPO_URL_HOSTS[url.hostname];
  if (!host) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  if (!owner || !repo) return null;
  const path = `${owner}/${repo}`;
  return host === "github" ? path : `${host}:${path}`;
}

// Stamps node tokens (inline/block) with the pluginId that created them, so
// renderRichTextNodeToken can route each to the correct plugin's renderer.
function stampRichTextNodeTokens(tokens, previousTokens, pluginId) {
  const stampedIds = new Set();
  // Only pass through previously stamped tokens to prevent cross-plugin forgery
  for (const token of previousTokens) {
    if (token.type === "inline" || token.type === "block") {
      stampedIds.add(token.pluginId);
    }
  }
  return tokens.map((token) => {
    if (token.type !== "inline" && token.type !== "block") return token;
    return {
      ...token,
      pluginId: stampedIds.has(token.pluginId) ? token.pluginId : pluginId,
    };
  });
}

export class PermissionsDeclinedError extends Error {
  constructor(message = "User declined permissions") {
    super(message);
    this.name = "PermissionsDeclinedError";
  }
}

export class PluginService extends ReactiveStore {
  constructor(preferencesProvider, session, dataLayer, hiddenFeedItemsStore) {
    super("pluginService");
    this.slingshot = new Slingshot();
    this.registries = {
      sidebarItems: new SignalSet(),
      eventListeners: new Map(),
      feedFilters: new Set(),
      richTextTransforms: new Set(),
    };
    this.$availableUpdates = new Signal.State(null);
    this.$rawRegistryListings = new Signal.State(null);
    this.$registryListings = new Signal.Computed(() => {
      const rawListings = this.$rawRegistryListings.get();
      if (!rawListings) return null;
      const installedIds = new Set(
        this.prefManager.$installedPlugins.get().map((entry) => entry.id),
      );
      const sortedListings = sortBy(rawListings, (listing) =>
        listing.name.toLowerCase(),
      );
      return sortedListings.map((listing) => ({
        ...listing,
        installed: installedIds.has(listing.id),
      }));
    });
    this.$pluginsInfo = new Signal.Computed(() => {
      const installedPlugins = this.prefManager.$installedPlugins.get();
      const visiblePlugins = this.localPluginsEnabled
        ? installedPlugins
        : installedPlugins.filter((entry) => !entry.id.endsWith("__LOCAL"));
      const sortedVisiblePlugins = sortBy(visiblePlugins, (plugin) =>
        plugin.name.toLowerCase(),
      );
      return sortedVisiblePlugins.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        version: entry.version,
        author: entry.author,
        enabled: entry.enabled,
        loaded: this.pluginBridge.isLoaded(entry.id),
        hasSettings: this.$settingTabs.get(entry.id) !== null,
      }));
    });
    // Bumped whenever a transform registers/unregisters
    this.$richTextTransformsVersion = new Signal.State(0);
    this._richTextTokensCache = new Map();
    this._pendingRichTextRuns = new Map();
    this._richTextQueue = [];
    this._richTextFlushScheduled = false;
    this._richTextElements = new WeakMap();
    this.$settingTabs = new SignalMap();
    this.$slots = new SignalMap();
    this.localPluginsEnabled = isDev();
    this.remoteRegistry = new RemotePluginRegistry(PLUGIN_REGISTRY_URL);
    this.localRegistry = this.localPluginsEnabled
      ? new LocalPluginRegistry()
      : null;
    this.pluginCache = new PluginCache();
    this.sourceProvider = new SourceProvider(this.pluginCache);
    this.pluginStylesLoader = new PluginStylesLoader();
    this.pluginBridge = new PluginBridge(
      this.sourceProvider,
      this.pluginStylesLoader,
    );
    this.prefManager = new PluginPreferencesManager(preferencesProvider);
    this.$installedPlugins = new Signal.Computed(() =>
      this.prefManager.$installedPlugins.get(),
    );
    this.session = session;
    this.isPreviewMode = false;
    this._dataLayer = dataLayer;
    this._hiddenFeedItemsStore = hiddenFeedItemsStore;
    this._setupRegistries();
    this._setupHostMethods();
    this._setupFeedFilterIntegration();
  }

  _setupFeedFilterIntegration() {
    this._dataLayer.on("feedLoaded", async ({ feedURI, feed, reload }) => {
      const overrides = await this.getFilteredFeedItems(feedURI, feed);
      if (reload) {
        this._hiddenFeedItemsStore.replace(feedURI, overrides);
      } else {
        this._hiddenFeedItemsStore.merge(feedURI, overrides);
      }
    });
  }

  getRenderer(pluginId) {
    return new PluginRenderer(this.pluginBridge, pluginId);
  }

  // icon can be string | VirtualEl
  // if string, render an app-icon, if VirtualEl, render to DOM node
  _createIconElement(pluginId, icon) {
    if (icon == null) return null;
    if (typeof icon === "string") {
      const el = document.createElement("app-icon");
      el.setAttribute("icon", icon);
      return el;
    }
    if (typeof icon === "object") {
      try {
        const el = this.getRenderer(pluginId).createRoot().render(icon);
        el.classList.add("plugin-icon");
        return el;
      } catch (error) {
        console.warn(`Plugin ${pluginId} icon render failed:`, error);
        return null;
      }
    }
    return null;
  }

  _setupRegistries() {
    this.pluginBridge.addRegistrationTarget(
      "sidebarItem",
      (plugin, message) => {
        const entry = {
          pluginId: plugin.pluginId,
          icon: message.icon,
          iconElement: this._createIconElement(plugin.pluginId, message.icon),
          title: message.title,
          invoke: () => plugin.call(message.handlerId),
        };
        this.registries.sidebarItems.add(entry);
        return () => this.registries.sidebarItems.delete(entry);
      },
    );
    this.pluginBridge.addRegistrationTarget(
      "eventListener",
      (plugin, message) => {
        let listeners = this.registries.eventListeners.get(message.event);
        if (!listeners) {
          listeners = new Map();
          this.registries.eventListeners.set(message.event, listeners);
        }
        const handler = (...args) => plugin.call(message.handlerId, ...args);
        listeners.set(plugin.pluginId, handler);
        return () => listeners.delete(plugin.pluginId);
      },
    );
    this.pluginBridge.addRegistrationTarget("settingTab", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        name: message.name,
        display: () => plugin.call(message.displayHandlerId),
        hide: () => plugin.call(message.hideHandlerId),
      };
      this.$settingTabs.set(plugin.pluginId, entry);
      return () => {
        if (this.$settingTabs.get(plugin.pluginId) === entry) {
          this.$settingTabs.delete(plugin.pluginId);
        }
      };
    });
    this.pluginBridge.addRegistrationTarget("feedFilter", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        invoke: (feedURI, feedItems) =>
          plugin.call(message.handlerId, feedURI, feedItems),
      };
      this.registries.feedFilters.add(entry);
      return () => this.registries.feedFilters.delete(entry);
    });
    this.pluginBridge.addRegistrationTarget(
      "richTextTransform",
      (plugin, message) => {
        const entry = {
          pluginId: plugin.pluginId,
          handlesFacetTypes: Array.isArray(message.handlesFacetTypes)
            ? message.handlesFacetTypes
            : [],
          invoke: (batch) => plugin.call(message.handlerId, batch),
        };
        this.registries.richTextTransforms.add(entry);
        this._invalidateRichTextTransforms();
        return () => {
          this.registries.richTextTransforms.delete(entry);
          this._invalidateRichTextTransforms();
        };
      },
    );
    this.pluginBridge.addRegistrationTarget("slot", (plugin, message) => {
      const entry = {
        pluginId: plugin.pluginId,
        invoke: (context) => plugin.call(message.handlerId, context),
      };
      const current = this.$slots.get(message.name) ?? [];
      this.$slots.set(message.name, [...current, entry]);
      return () => {
        const list = this.$slots.get(message.name);
        if (!list) return;
        const next = list.filter((other) => other !== entry);
        if (next.length === 0) {
          this.$slots.delete(message.name);
        } else {
          this.$slots.set(message.name, next);
        }
      };
    });
  }

  _setupHostMethods() {
    this.pluginBridge.addHostMethod(
      "openModal",
      (plugin, { modalId, title, content }) => {
        showPluginModal({
          pluginRenderer: this.getRenderer(plugin.pluginId),
          pluginId: plugin.pluginId,
          modalId,
          title,
          content,
          onDismiss: () => {
            plugin.sendEvent("modalDismissed", {
              modalId,
            });
          },
        });
      },
    );

    this.pluginBridge.addHostMethod("closeModal", (plugin, { modalId }) => {
      hidePluginModal({ pluginId: plugin.pluginId, modalId });
    });

    this.pluginBridge.addHostMethod("loadData", (plugin) => {
      return this.prefManager.readSettingsForPlugin(plugin.pluginId);
    });

    this.pluginBridge.addHostMethod("saveData", async (plugin, { data }) => {
      await this.prefManager.writeSettingsForPlugin(plugin.pluginId, data);
    });

    this.pluginBridge.addHostMethod("loadLocalData", (plugin) => {
      return getLocalData(plugin.pluginId);
    });

    this.pluginBridge.addHostMethod("saveLocalData", (plugin, { data }) => {
      setLocalData(plugin.pluginId, data);
    });

    this.pluginBridge.addHostMethod(
      "refreshSettingTab",
      (plugin, { reset = false } = {}) => {
        this.emit("settingTabRefresh", { pluginId: plugin.pluginId, reset });
      },
    );

    // Forces every mounted <plugin-slot name=...> to re-invoke its
    // registered plugins, for slots whose content depends on data that
    // resolved asynchronously after the initial render (e.g. a plugin that
    // fetches something on a cache miss and wants to redraw once it lands).
    this.pluginBridge.addHostMethod("refreshSlot", (plugin, { name }) => {
      const current = this.$slots.get(name);
      if (current) this.$slots.set(name, [...current]);
    });

    this.pluginBridge.addHostMethod(
      "refreshFeedFilters",
      (plugin, feedURI = null) => {
        this.refreshFeedFilters(feedURI);
      },
    );

    this.pluginBridge.addHostMethod(
      "applyStyleSnippet",
      (plugin, { snippetId, cssText }) => {
        this.pluginStylesLoader.mountSnippet(
          plugin.pluginId,
          snippetId,
          cssText,
        );
      },
    );

    this.pluginBridge.addHostMethod(
      "removeStyleSnippet",
      (plugin, { snippetId }) => {
        this.pluginStylesLoader.unmountSnippet(plugin.pluginId, snippetId);
      },
    );

    this.pluginBridge.addHostMethod(
      "showToast",
      (plugin, { toastId, element, timeout }) => {
        showPluginToast({
          pluginRenderer: this.getRenderer(plugin.pluginId),
          pluginId: plugin.pluginId,
          toastId,
          element,
          timeout,
        });
      },
    );

    this.pluginBridge.addHostMethod("hideToast", (plugin, { toastId }) => {
      hidePluginToast({ pluginId: plugin.pluginId, toastId });
    });

    this.pluginBridge.addHostMethod("fetch", (plugin, { url, init }) => {
      return pluginFetch(plugin, url, init);
    });

    this.pluginBridge.addHostMethod("getPost", async (plugin, { uri }) => {
      try {
        return await this._dataLayer.declarative.ensurePost(uri);
      } catch {
        return null;
      }
    });

    this.pluginBridge.addHostMethod("getProfile", async (plugin, { did }) => {
      const profile = this._dataLayer.derived.$hydratedProfiles.get(did);
      if (profile) return profile;
      try {
        await this._dataLayer.declarative.ensureDetailedProfile(did);
      } catch {
        return null;
      }
      return this._dataLayer.derived.$hydratedProfiles.get(did) ?? null;
    });

    this.pluginBridge.addHostMethod(
      "getDetailedProfile",
      async (plugin, { did }) => {
        try {
          return await this._dataLayer.declarative.ensureDetailedProfile(did);
        } catch {
          return null;
        }
      },
    );

    // Full known-followers list for did (the profile.viewer.knownFollowers
    // included on getProfile/getDetailedProfile is capped to a handful).
    // The AppView doesn't currently paginate this endpoint in practice, so
    // this is a single round-trip, not a cursor loop.
    this.pluginBridge.addHostMethod(
      "getKnownFollowers",
      async (plugin, { did }) => {
        try {
          return await this._dataLayer.declarative.ensureKnownFollowers(did);
        } catch {
          return null;
        }
      },
    );

    this.pluginBridge.addHostMethod("getRecord", (plugin, args) =>
      this.slingshot.getRecord(args),
    );

    this.pluginBridge.addHostMethod(
      "putRecord",
      async (plugin, { rkey, record }) => {
        this._requireSignedIn();
        this._requireRecordWritePermission(plugin);
        requireHostMethodArg("putRecord", "rkey", rkey);
        if (!isValidRkey(rkey)) {
          throw new Error(`putRecord: invalid rkey "${rkey}"`);
        }
        requireHostMethodArg("putRecord", "record", record);
        const existing = await this._dataLayer.api.getOwnRecord(
          SHARED_PLUGIN_RECORDS_COLLECTION,
          rkey,
        );
        if (existing && existing.value?.$plugin !== plugin.pluginId) {
          throw new Error(
            `putRecord: rkey "${rkey}" belongs to another plugin`,
          );
        }
        return await this._dataLayer.api.putRecord(
          SHARED_PLUGIN_RECORDS_COLLECTION,
          rkey,
          // $type must equal the collection it's stored in — that's an AT
          // Protocol invariant the real PDS enforces (unlike a naive mock),
          // so a plugin-supplied $type would always 400. Force it, same as
          // $plugin, rather than let every plugin author discover this the
          // hard way.
          {
            ...record,
            $type: SHARED_PLUGIN_RECORDS_COLLECTION,
            $plugin: plugin.pluginId,
          },
        );
      },
    );

    this.pluginBridge.addHostMethod(
      "deleteRecord",
      async (plugin, { rkey }) => {
        this._requireSignedIn();
        this._requireRecordWritePermission(plugin);
        requireHostMethodArg("deleteRecord", "rkey", rkey);
        if (!isValidRkey(rkey)) {
          throw new Error(`deleteRecord: invalid rkey "${rkey}"`);
        }
        const existing = await this._dataLayer.api.getOwnRecord(
          SHARED_PLUGIN_RECORDS_COLLECTION,
          rkey,
        );
        if (!existing) return;
        if (existing.value?.$plugin !== plugin.pluginId) {
          throw new Error(
            `deleteRecord: rkey "${rkey}" belongs to another plugin`,
          );
        }
        return await this._dataLayer.api.deleteRecord(
          SHARED_PLUGIN_RECORDS_COLLECTION,
          rkey,
        );
      },
    );

    this.pluginBridge.addHostMethod(
      "listRecords",
      async (plugin, { cursor, limit } = {}) => {
        this._requireSignedIn();
        this._requireRecordWritePermission(plugin);
        const page = await this._dataLayer.api.listOwnRecords(
          SHARED_PLUGIN_RECORDS_COLLECTION,
          cursor,
          limit,
        );
        // Other plugins' records live in this same shared collection —
        // filter to this plugin's own before it ever reaches plugin code,
        // the same isolation boundary putRecord/deleteRecord enforce, so a
        // plugin can't enumerate what another plugin has stored just by
        // declaring the same "write" scope.
        return {
          ...page,
          records: (page?.records ?? []).filter(
            (record) => record.value?.$plugin === plugin.pluginId,
          ),
        };
      },
    );

    this.pluginBridge.addHostMethod("getCurrentUser", () => {
      if (!this.session) return null;
      return {
        did: this.session.did,
        handle: this.session.handle,
      };
    });

    this.pluginBridge.addHostMethod(
      "muteActor",
      async (plugin, { did, mute = true }) => {
        this._requireSignedIn();
        this._requireActionPermission(plugin, "mute");
        requireHostMethodArg("muteActor", "did", did);
        const profile = await this._dataLayer.declarative.ensureProfile(did);
        if (mute) await this._dataLayer.mutations.muteProfile(profile);
        else await this._dataLayer.mutations.unmuteProfile(profile);
      },
    );

    this.pluginBridge.addHostMethod(
      "blockActor",
      async (plugin, { did, block = true }) => {
        this._requireSignedIn();
        this._requireActionPermission(plugin, "block");
        requireHostMethodArg("blockActor", "did", did);
        const profile = await this._dataLayer.declarative.ensureProfile(did);
        if (block) await this._dataLayer.mutations.blockProfile(profile);
        else await this._dataLayer.mutations.unblockProfile(profile);
      },
    );

    this.pluginBridge.addHostMethod(
      "showLessLikeThis",
      async (plugin, { postUri, feedUri = null }) => {
        this._requireSignedIn();
        this._requireActionPermission(plugin, "feedFeedback");
        requireHostMethodArg("showLessLikeThis", "postUri", postUri);
        requireHostMethodArg("showLessLikeThis", "feedUri", feedUri);
        const { feedContext, feedProxyUrl } = this._resolveFeedAttribution(
          postUri,
          feedUri,
        );
        await this._dataLayer.mutations.sendShowLessInteraction(
          postUri,
          feedUri,
          feedContext,
          feedProxyUrl,
        );
      },
    );

    this.pluginBridge.addHostMethod(
      "showMoreLikeThis",
      async (plugin, { postUri, feedUri = null }) => {
        this._requireSignedIn();
        this._requireActionPermission(plugin, "feedFeedback");
        requireHostMethodArg("showMoreLikeThis", "postUri", postUri);
        requireHostMethodArg("showMoreLikeThis", "feedUri", feedUri);
        const { feedContext, feedProxyUrl } = this._resolveFeedAttribution(
          postUri,
          feedUri,
        );
        await this._dataLayer.mutations.sendShowMoreInteraction(
          postUri,
          feedUri,
          feedContext,
          feedProxyUrl,
        );
      },
    );
  }

  _resolveFeedAttribution(postUri, feedUri) {
    const feed = this._dataLayer.dataStore.$feeds.get(feedUri);
    const feedItem = feed?.feed.find((item) => item.post.uri === postUri);
    const feedGenerator = this._dataLayer.derived.$feedGenerators.get(feedUri);
    return {
      feedContext: feedItem?.feedContext ?? null,
      feedProxyUrl: getFeedGeneratorProxyUrl(feedGenerator),
    };
  }

  _requireSignedIn() {
    if (!this.session) throw new Error("Not signed in");
  }

  _requireActionPermission(plugin, action) {
    if (!isActionAllowed(action, plugin.permissions)) {
      throw new Error(
        `"${plugin.pluginId}" does not have "${action}" action permission`,
      );
    }
  }

  _requireRecordWritePermission(plugin) {
    if (!isRecordWriteAllowed(plugin.permissions)) {
      throw new Error(`"${plugin.pluginId}" does not have records permission`);
    }
  }

  async loadEnabledPlugins() {
    if (arePluginsDisabledByQueryParam()) {
      const enabledPluginIds = this.prefManager.$enabledPlugins
        .get()
        .map((entry) => entry.id);
      await this.prefManager.setPluginsDisabled(enabledPluginIds);
      return;
    }
    const previewPluginIds = getPluginPreviewIdsFromQueryParam();
    if (previewPluginIds.length > 0) {
      if (!this.session) {
        this.isPreviewMode = true;
        // Serial to avoid racing on preferences
        for (const previewPluginId of previewPluginIds) {
          await this._installPreviewPlugin(previewPluginId);
        }
      } else {
        showToast(`You must be logged out to view plugin preview links`, {
          style: "warning",
          timeout: 5000,
        });
      }
    }
    const enabledPlugins = this.prefManager.$enabledPlugins
      .get()
      .filter(
        (entry) => this.localPluginsEnabled || !entry.id.endsWith("__LOCAL"),
      );
    const { erroredPlugins } =
      await this.pluginBridge.loadPlugins(enabledPlugins);
    if (erroredPlugins.length) {
      const groupedErrors = groupBy(
        erroredPlugins,
        (erroredPlugin) => erroredPlugin.error?.message ?? "Unknown error",
      );
      for (const [message, group] of groupedErrors) {
        const pluginIds = group.map(({ pluginId }) => pluginId);
        showToast(
          `Failed to load plugin(s): ${pluginIds.join(", ")} - ${message}`,
          { style: "error", timeout: 5000 },
        );
      }
    }
    // Reconcile against all installed plugins (not just enabled) so disabled
    // plugins keep their cached assets on re-enable
    const installedPlugins = this.prefManager.$installedPlugins.get();
    await this._reconcileCache(installedPlugins);
  }

  async _installPreviewPlugin(pluginId) {
    const listing =
      (await this.remoteRegistry.getListing(pluginId).catch(() => null)) ??
      (this.localRegistry
        ? await this.localRegistry.getListing(pluginId).catch(() => null)
        : null);
    if (!listing) {
      showToast(`Plugin "${pluginId}" not found`, {
        style: "error",
        timeout: 5000,
      });
      return;
    }
    let manifest = null;
    try {
      manifest = await this.sourceProvider.getLiveManifest(
        pluginId,
        listing.repo,
      );
    } catch (e) {
      console.error("Failed to fetch manifest for preview", e);
      showToast(`Failed to load plugin "${pluginId}"`, {
        style: "error",
        timeout: 5000,
      });
      return;
    }
    const permissions = getPermissionsFromManifest(manifest);
    if (!isEmptyPermissions(permissions)) {
      showToast(
        `"${manifest.name}" can't be previewed because it requires user permissions.`,
        { style: "error", timeout: 5000 },
      );
      return;
    }
    const { name, version, author, description } = manifest;
    await this.prefManager.addInstalledPlugin({
      id: pluginId,
      name,
      version,
      author,
      description,
      repo: listing.repo,
      enabled: true,
      permissions,
    });
  }

  async checkForUpdates() {
    // Load listings first to ensure we have the latest repo URLs for plugins
    await this.loadRegistryListings();
    const installedPlugins = this.prefManager.$installedPlugins.get();
    const results = await Promise.allSettled(
      installedPlugins.map(async (entry) => {
        const liveManifest = await this.sourceProvider.getLiveManifest(
          entry.id,
          entry.repo,
        );
        if (compareVersions(liveManifest.version, entry.version) > 0) {
          return { id: entry.id, version: liveManifest.version };
        }
        return null;
      }),
    );
    const updates = new Map();
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        updates.set(result.value.id, result.value.version);
      }
    }
    this.$availableUpdates.set(updates);
    return updates;
  }

  _clearAvailableUpdate(pluginId) {
    const updates = this.$availableUpdates.get();
    if (!updates?.has(pluginId)) return;
    const next = new Map(updates);
    next.delete(pluginId);
    this.$availableUpdates.set(next);
  }

  async reloadPlugins() {
    const installedPlugins = this.prefManager.$installedPlugins.get();
    const results = await Promise.allSettled(
      installedPlugins
        .filter((entry) => entry.enabled === true)
        .map(async (entry) => {
          try {
            await this.pluginBridge.reloadPlugin(
              entry.id,
              entry.version,
              entry.repo,
            );
          } catch (e) {
            await this.prefManager.setPluginDisabled(entry.id);
            throw e;
          }
        }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  async getManifest(pluginId) {
    const installedPlugin = this.prefManager.$installedPlugin.get(pluginId);
    return this.sourceProvider
      .getManifest(pluginId, installedPlugin?.version, installedPlugin?.repo)
      .catch(() => null);
  }

  async getLiveManifest(pluginId, repo) {
    return this.sourceProvider.getLiveManifest(pluginId, repo);
  }

  async getReadme(pluginId, repo) {
    return this.sourceProvider.getReadme(pluginId, repo);
  }

  async _reconcileCache(installed) {
    const urlLists = await Promise.all(
      installed.map((entry) =>
        this.sourceProvider.getCacheUrls(entry.id, entry.version, entry.repo),
      ),
    );
    await this.pluginCache.reconcile(urlLists.flat());
  }

  async installPlugin(pluginId) {
    let repo = null;
    if (!pluginId.endsWith("__LOCAL")) {
      const listing = await this.remoteRegistry.getListing(pluginId);
      if (!listing) {
        throw new Error(`unknown plugin: ${pluginId}`);
      }
      repo = listing.repo;
    }
    const installedPlugins = this.prefManager.$installedPlugins.get();
    if (installedPlugins.some((plugin) => plugin.id === pluginId)) {
      throw new Error(`Plugin ${pluginId} already installed`);
    }
    let manifest = null;
    try {
      manifest = await this.sourceProvider.getLiveManifest(pluginId, repo);
    } catch (e) {
      console.error("Failed to fetch manifest", e);
      throw new Error("Failed to fetch manifest");
    }
    const permissions = getPermissionsFromManifest(manifest);
    if (!isEmptyPermissions(permissions)) {
      if (
        !(await showPluginInstallPermissionsModal({
          pluginName: manifest.name,
          permissions,
        }))
      ) {
        throw new PermissionsDeclinedError();
      }
    }
    const { name, version, author, description } = manifest;
    await this.prefManager.addInstalledPlugin({
      id: pluginId,
      name,
      version,
      author,
      description,
      repo,
      enabled: true,
      permissions,
    });
    try {
      await this.pluginBridge.loadPlugin(pluginId, version, repo);
    } catch (e) {
      console.error(e);
      await this.prefManager.removeInstalledPlugin(pluginId);
      throw e;
    }
  }

  async installUnregisteredPlugin(url) {
    const repo = parseRepoUrl(url);
    if (!repo) {
      throw new Error("Invalid repo URL: must be a GitHub or Tangled repo");
    }
    let manifest = null;
    try {
      manifest = await this.sourceProvider.getLiveManifestFromRepo(repo);
    } catch (e) {
      console.error("Failed to fetch manifest", e);
      throw new Error("Failed to fetch manifest");
    }
    const permissions = getPermissionsFromManifest(manifest);
    if (!isEmptyPermissions(permissions)) {
      if (
        !(await showPluginInstallPermissionsModal({
          pluginName: manifest.name,
          permissions,
        }))
      ) {
        throw new PermissionsDeclinedError();
      }
    }
    const { id, name, version, author, description } = manifest;
    if (await this.remoteRegistry.getListing(id)) {
      throw new Error(`Plugin ${id} is in the registry; install it from there`);
    }
    if (this.localRegistry && (await this.localRegistry.getListing(id))) {
      throw new Error(`Plugin ${id} is in the registry; install it from there`);
    }
    const installedPlugins = this.prefManager.$installedPlugins.get();
    if (installedPlugins.some((plugin) => plugin.id === id)) {
      throw new Error(`Plugin ${id} already installed`);
    }
    await this.prefManager.addInstalledPlugin({
      id,
      name,
      version,
      author,
      description,
      repo,
      enabled: true,
      permissions,
    });
    try {
      await this.pluginBridge.loadPlugin(id, version, repo);
    } catch (e) {
      console.error(e);
      await this.prefManager.removeInstalledPlugin(id);
      throw e;
    }
    return { id, name };
  }

  async uninstallPlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this.prefManager.removeInstalledPlugin(pluginId);
    await this.prefManager.clearSettingsForPlugin(pluginId);
    clearLocalData(pluginId);
    await this._reconcileCache(this.prefManager.$installedPlugins.get());
  }

  async enablePlugin(pluginId) {
    await this.prefManager.setPluginEnabled(pluginId);
    const installedPlugin = this.prefManager.$installedPlugin.get(pluginId);
    try {
      await this.pluginBridge.loadPlugin(
        pluginId,
        installedPlugin.version,
        installedPlugin.repo,
      );
    } catch (e) {
      await this.prefManager.setPluginDisabled(pluginId);
      throw e;
    }
  }

  async disablePlugin(pluginId) {
    this.pluginBridge.unloadPlugin(pluginId);
    await this.prefManager.setPluginDisabled(pluginId);
  }

  async updatePlugin(pluginId) {
    const installedPlugin = this.prefManager.$installedPlugin.get(pluginId);
    if (!installedPlugin) return null;
    const liveManifest = await this.sourceProvider.getLiveManifest(
      pluginId,
      installedPlugin.repo,
    );
    if (compareVersions(liveManifest.version, installedPlugin.version) > 0) {
      const currentPermissions = installedPlugin.permissions ?? {};
      const permissions = getPermissionsFromManifest(liveManifest);
      const permissionsDiff = diffPermissions(currentPermissions, permissions);
      if (permissionsDiff) {
        const accepted = await showPluginUpdatePermissionsModal({
          pluginName: liveManifest.name,
          pluginVersion: liveManifest.version,
          permissionsDiff,
        });
        if (!accepted) throw new PermissionsDeclinedError();
      }
      const { name, version, author, description } = liveManifest;
      await this.prefManager.updateInstalledPlugin(pluginId, (entry) => ({
        ...entry,
        name,
        version,
        author,
        description,
        permissions,
      }));
      await this.pluginBridge.reloadPlugin(
        pluginId,
        version,
        installedPlugin.repo,
      );
      this._clearAvailableUpdate(pluginId);
      return { updated: true, version };
    }
    this._clearAvailableUpdate(pluginId);
    return { updated: false };
  }

  async updateAllPlugins() {
    const availableUpdates = this.$availableUpdates.get();
    if (!availableUpdates || availableUpdates.size === 0) {
      return { updated: [], failed: [], declined: [] };
    }
    const ids = [...availableUpdates.keys()];
    const updated = [];
    const failed = [];
    const declined = [];
    // Serial to avoid racing read-modify-write on installed plugin preferences
    for (const pluginId of ids) {
      try {
        const result = await this.updatePlugin(pluginId);
        if (result?.updated) updated.push(pluginId);
      } catch (e) {
        if (e instanceof PermissionsDeclinedError) {
          declined.push(pluginId);
        } else {
          failed.push(pluginId);
        }
      }
    }
    return { updated, failed, declined };
  }

  async loadRegistryListings() {
    const remoteListings = await this.remoteRegistry.getListings();
    const localListings = this.localRegistry
      ? await this.localRegistry.getListings()
      : [];
    this.$rawRegistryListings.set([...remoteListings, ...localListings]);
    await this._reconcileInstalledPluginRepos(remoteListings);
  }

  async _reconcileInstalledPluginRepos(listings) {
    // If a plugin is installed but its repo URL has changed, update it in preferences
    const listingById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );
    const installedPlugins = this.prefManager.$installedPlugins.get();
    let changed = false;
    const updated = installedPlugins.map((plugin) => {
      const listing = listingById.get(plugin.id);
      if (listing && listing.repo && listing.repo !== plugin.repo) {
        changed = true;
        return { ...plugin, repo: listing.repo };
      }
      return plugin;
    });
    if (changed) {
      await this.prefManager.setInstalledPlugins(updated);
    }
  }

  // Registry convenience methods

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  getSlotEntries(name) {
    return [...(this.$slots.get(name) ?? [])];
  }

  getSettingTabs() {
    return [...this.$settingTabs.values()];
  }

  getSettingTab(pluginId) {
    return this.$settingTabs.get(pluginId);
  }

  async getPostContextMenuItems(post, meta = null) {
    return this._collectContextMenuItems("post-context-menu", post, meta);
  }

  async getProfileContextMenuItems(profile) {
    return this._collectContextMenuItems("profile-context-menu", profile);
  }

  async getPostComposerInit({ kind, replyTo, replyRoot, quotedPost }) {
    const listeners = this.registries.eventListeners.get("post-composer-open");
    if (!listeners || listeners.size === 0) return null;
    const context = { kind, replyTo, replyRoot, quotedPost };
    const results = await Promise.all(
      [...listeners].map(async ([pluginId, handler]) => {
        try {
          return await handler(context);
        } catch (error) {
          console.error(
            `Plugin ${pluginId} post-composer-open handler failed:`,
            error,
          );
          return null;
        }
      }),
    );
    let text = "";
    let cursor = null;
    let touched = false;
    for (const result of results) {
      if (!result) continue;
      for (const op of result.ops ?? []) {
        if (op.op === "set") text = op.text;
        else if (op.op === "append") text = text + op.text;
        else if (op.op === "prepend") text = op.text + text;
        else continue;
        touched = true;
      }
      if (result.cursor != null) {
        cursor = result.cursor;
        touched = true;
      }
    }
    if (!touched) return null;
    return { text, cursor };
  }

  async _collectContextMenuItems(event, target, meta = null) {
    const listeners = this.registries.eventListeners.get(event);
    if (!listeners || listeners.size === 0) return [];
    const results = await Promise.all(
      [...listeners].map(async ([pluginId, handler]) => {
        try {
          const items =
            meta != null ? await handler(target, meta) : await handler(target);
          return (items ?? []).map((item) => {
            const entry = {
              pluginId,
              icon: item.icon,
              iconElement: this._createIconElement(pluginId, item.icon),
              title: item.title,
              invoke: () =>
                this.pluginBridge
                  .getInstance(pluginId)
                  .call(item.handlerId, target),
            };
            return entry;
          });
        } catch (error) {
          console.error(`Plugin ${pluginId} ${event} handler failed:`, error);
          return [];
        }
      }),
    );
    return results.flat();
  }

  // RPC

  async getFilteredFeedItems(feedUri, feed) {
    const filteredFeedItems = {};
    for (const feedFilter of this.registries.feedFilters) {
      const feedItems = feed.feed;
      let results = null;
      try {
        results = await feedFilter.invoke(feedUri, feedItems);
      } catch (e) {
        console.error(
          `Plugin ${feedFilter.pluginId} feed filter raised an exception`,
          e,
        );
      }
      if (!results || typeof results !== "object") continue;
      for (const [uri, keep] of Object.entries(results)) {
        if (keep === false) {
          filteredFeedItems[uri] = false;
        }
      }
    }
    return filteredFeedItems;
  }

  async refreshFeedFilters(feedURI = null) {
    const feedURIs = feedURI
      ? [feedURI]
      : Array.from(this._dataLayer.dataStore.$feeds.keys());
    await Promise.all(
      feedURIs.map(async (uri) => {
        const feed = this._dataLayer.dataStore.$feeds.get(uri);
        if (!feed) return;
        const overrides = await this.getFilteredFeedItems(uri, feed);
        this._hiddenFeedItemsStore.replace(uri, overrides);
      }),
    );
  }

  // Rich-text transform pipeline

  _invalidateRichTextTransforms() {
    this._pendingRichTextRuns.clear();
    this._richTextTokensCache.clear();
    this.$richTextTransformsVersion.set(
      this.$richTextTransformsVersion.get() + 1,
    );
  }

  getClaimedFacetTypes() {
    const types = new Set();
    for (const entry of this.registries.richTextTransforms) {
      if (!entry.handlesFacetTypes) continue;
      for (const type of entry.handlesFacetTypes) types.add(type);
    }
    return types;
  }

  // Results are cached by (uri, surface); requests are batched per render flush
  async transformRichTextTokens(tokens, context) {
    if (this.registries.richTextTransforms.size === 0) return null;
    const key = `${context.uri}|${context.surface}`;
    const cached = this._richTextTokensCache.get(key);
    if (cached && cached.text === context.source.text) {
      return cached.tokens;
    }
    const pending = this._pendingRichTextRuns.get(key);
    if (pending) return pending;
    const item = { key, baseTokens: tokens, tokens, context };
    const promise = new Promise((resolve) => {
      item.resolve = resolve;
    });
    this._pendingRichTextRuns.set(key, promise);
    this._richTextQueue.push(item);
    if (!this._richTextFlushScheduled) {
      this._richTextFlushScheduled = true;
      queueMicrotask(() => {
        this._richTextFlushScheduled = false;
        const items = this._richTextQueue.splice(0);
        this._runRichTextTransforms(
          items,
          this.$richTextTransformsVersion.get(),
        );
      });
    }
    return promise;
  }

  async _runRichTextTransforms(items, version) {
    for (const transform of this.registries.richTextTransforms) {
      const batch = items.map((item) => ({
        tokens: item.tokens,
        context: item.context,
      }));
      let results = null;
      try {
        results = await transform.invoke(batch);
      } catch (e) {
        console.error(
          `Plugin ${transform.pluginId} rich text transform raised an exception`,
          e,
        );
      }
      if (!Array.isArray(results)) continue;
      items.forEach((item, index) => {
        const result = results[index];
        if (!result || result.error != null) {
          if (result?.error != null) {
            console.error(
              `Plugin ${transform.pluginId} rich text transform failed: ${result.error}`,
            );
          }
          return;
        }
        if (!validateRichTextTokens(result.value)) {
          console.error(
            `Plugin ${transform.pluginId} rich text transform returned malformed tokens`,
          );
          return;
        }
        try {
          const hydrated = hydrateRichTextFacets(result.value, item.baseTokens);
          item.tokens = stampRichTextNodeTokens(
            hydrated,
            item.tokens,
            transform.pluginId,
          );
        } catch (error) {
          console.error(
            `Plugin ${transform.pluginId} rich text transform returned an unrecognized facet`,
            error,
          );
        }
      });
    }
    // Discard if transforms changed mid-run
    const isStale = version !== this.$richTextTransformsVersion.get();
    for (const item of items) {
      if (isStale) {
        item.resolve(null);
        continue;
      }
      this._pendingRichTextRuns.delete(item.key);
      this._richTextTokensCache.set(item.key, {
        text: item.context.source.text,
        tokens: item.tokens,
      });
      item.resolve(item.tokens);
    }
  }

  // Mounts a node token's VirtualEl via the owning plugin's renderer.
  // Elements are cached by host / token
  renderRichTextNodeToken(token, host) {
    if (!token.pluginId || !token.node || !host) return null;
    let byToken = this._richTextElements.get(host);
    if (!byToken) {
      byToken = new WeakMap();
      this._richTextElements.set(host, byToken);
    }
    let cached = byToken.get(token);
    if (!cached) {
      let renderer = null;
      try {
        renderer = this.getRenderer(token.pluginId);
      } catch {
        return null;
      }
      cached = { root: renderer.createRoot() };
      byToken.set(token, cached);
    }
    return cached.root.render(token.node);
  }
}
