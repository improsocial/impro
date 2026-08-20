import { PluginBridge } from "/js/plugins/pluginBridge.js";
import {
  showPluginModal,
  updatePluginModal,
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
import { PluginBinaryCache } from "/js/plugins/pluginBinaryCache.js";
import {
  PluginLocalDataStore,
  PluginMemoryDataStore,
} from "/js/plugins/pluginLocalDataStore.js";
import { PluginPreferencesManager } from "/js/plugins/pluginPreferencesManager.js";
import { PluginRichTextDispatcher } from "/js/plugins/pluginRichTextDispatcher.js";
import { PluginSlotDispatcher } from "/js/plugins/pluginSlotDispatcher.js";
import { SourceProvider } from "/js/plugins/sourceProvider.js";
import { TangledResolver } from "/js/tangled.js";
import { PluginStylesLoader } from "/js/plugins/pluginStylesLoader.js";
import { PluginRequests } from "/js/plugins/pluginRequests.js";
import { PluginDataProvider } from "/js/plugins/pluginDataProvider.js";
import { Slingshot } from "/js/slingshot.js";
import { PluginPermissionsManager } from "/js/plugins/pluginPermissionsManager.js";
import {
  compareVersions,
  groupBy,
  isDev,
  requireArg,
  sortBy,
} from "/js/utils.js";
import {
  Signal,
  SignalMap,
  SignalSet,
  ReactiveStore,
  untrack,
} from "/js/signals.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { PLUGIN_REGISTRY_URL } from "/js/config.js";
import { getFeedGeneratorProxyUrl } from "/js/dataHelpers.js";

const DISABLE_PLUGINS_QUERY_PARAM = "disable-plugins";

const INITIAL_PLUGIN_LOAD_TIMEOUT_MS = 3000;

export const PLUGIN_PREVIEW_QUERY_PARAM = "plugin-preview";

// Page id must also be a valid URL segment
const PAGE_ID_PATTERN = /^[a-z0-9-]+$/;

export function createPluginPageKey(pluginId, pageId) {
  return `${pluginId}:${pageId}`;
}

// Small handle for registrations that render custom content,
// can be passed through to <plugin-custom-content>
export class CustomContent {
  constructor(pluginId, { display }) {
    this.pluginId = pluginId;
    this.display = display;
    this.$refresh = new Signal.State(null);
  }
  refresh({ reset = false } = {}) {
    this.$refresh.set({ reset });
  }
}

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

export class PermissionsDeclinedError extends Error {
  constructor(message = "User declined permissions") {
    super(message);
    this.name = "PermissionsDeclinedError";
  }
}

export class PluginService extends ReactiveStore {
  constructor(
    preferencesProvider,
    session,
    dataLayer,
    hiddenFeedItemsStore,
    router,
    constellation,
    identityResolver,
  ) {
    super("pluginService");
    this.renderContext = null;
    this.router = router;
    this.slingshot = new Slingshot();
    this.constellation = constellation;
    this.registries = {
      sidebarItems: new SignalSet(),
      eventListeners: new Map(),
      feedFilters: new Set(),
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
        hasSettings: this.$settingTabs.get(entry.id) !== null,
        hasSystemSettings: this.permissionsManager.hasUserGrantedFetchOrigins(
          entry.id,
        ),
      }));
    });
    this.$settingTabs = new SignalMap();
    // Keyed by `${pluginId}:${pageId}` — each plugin can register multiple pages
    this.$pages = new SignalMap();
    this.$initialLoadComplete = new Signal.State(false);
    this._initialLoadPromise = new Promise((resolve) => {
      this._resolveInitialLoad = resolve;
    });
    this.slotDispatcher = new PluginSlotDispatcher();
    this.richTextDispatcher = new PluginRichTextDispatcher({
      getRenderer: (pluginId) => this.getRenderer(pluginId),
    });
    this.localPluginsEnabled = isDev();
    this.remoteRegistry = new RemotePluginRegistry(PLUGIN_REGISTRY_URL);
    this.localRegistry = this.localPluginsEnabled
      ? new LocalPluginRegistry()
      : null;
    this.pluginCache = new PluginCache();
    this.binaryCache = new PluginBinaryCache();
    this.sourceProvider = new SourceProvider(
      this.pluginCache,
      new TangledResolver(identityResolver),
    );
    this.pluginStylesLoader = new PluginStylesLoader();
    this.pluginBridge = new PluginBridge(
      this.sourceProvider,
      this.pluginStylesLoader,
    );
    this.prefManager = new PluginPreferencesManager(preferencesProvider);
    this.permissionsManager = new PluginPermissionsManager({
      prefManager: this.prefManager,
    });
    this.$installedPlugins = new Signal.Computed(() =>
      this.prefManager.$installedPlugins.get(),
    );
    this.session = session;
    this.localDataStore = session?.did
      ? new PluginLocalDataStore(session.did)
      : new PluginMemoryDataStore();
    this.isPreviewMode = false;
    this._dataLayer = dataLayer;
    this._hiddenFeedItemsStore = hiddenFeedItemsStore;
    this.pluginRequests = new PluginRequests({
      dataLayer,
      session,
      permissionsManager: this.permissionsManager,
    });
    this.pluginDataProvider = new PluginDataProvider({
      dataLayer,
      pluginRequests: this.pluginRequests,
      slingshot: this.slingshot,
      constellation: this.constellation,
      session,
    });
    this._setupRegistries();
    this._setupHostMethods();
    this._setupFeedFilterIntegration();
  }

  async _waitForInitialPluginLoad() {
    if (untrack(() => this.$initialLoadComplete.get())) return;
    let timeoutId = null;
    await Promise.race([
      this._initialLoadPromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, INITIAL_PLUGIN_LOAD_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutId);
  }

  _setupFeedFilterIntegration() {
    this._dataLayer.on("feedLoaded", async ({ feedURI, feed, reload }) => {
      await this._waitForInitialPluginLoad();
      const overrides = await this.getFilteredFeedItems(feedURI, feed);
      if (reload) {
        this._hiddenFeedItemsStore.replace(feedURI, overrides);
      } else {
        this._hiddenFeedItemsStore.merge(feedURI, overrides);
      }
    });
  }

  setRenderContext(renderContext) {
    this.renderContext = renderContext;
  }

  getRenderer(pluginId) {
    return new PluginRenderer(this.pluginBridge, pluginId, this.renderContext);
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
        customContent: new CustomContent(plugin.pluginId, {
          display: () => plugin.call(message.displayHandlerId),
        }),
        hide: () => plugin.call(message.hideHandlerId),
      };
      this.$settingTabs.set(plugin.pluginId, entry);
      return () => {
        if (this.$settingTabs.get(plugin.pluginId) === entry) {
          this.$settingTabs.delete(plugin.pluginId);
        }
      };
    });
    this.pluginBridge.addRegistrationTarget("page", (plugin, message) => {
      const pageId = message.id;
      if (typeof pageId !== "string" || !PAGE_ID_PATTERN.test(pageId)) {
        console.warn(
          `[plugins] "${plugin.pluginId}" tried to register a page with an invalid id:`,
          pageId,
        );
        return null;
      }
      const key = createPluginPageKey(plugin.pluginId, pageId);
      const entry = {
        pluginId: plugin.pluginId,
        pageId,
        title: message.title ?? null,
        customContent: new CustomContent(plugin.pluginId, {
          display: () => plugin.call(message.displayHandlerId),
        }),
      };
      this.$pages.set(key, entry);
      return () => {
        if (this.$pages.get(key) === entry) {
          this.$pages.delete(key);
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
      (plugin, message) =>
        this.richTextDispatcher.register({
          pluginId: plugin.pluginId,
          handlesFacetTypes: message.handlesFacetTypes,
          invoke: (batch) => plugin.call(message.handlerId, batch),
        }),
    );
    this.pluginBridge.addRegistrationTarget("slot", (plugin, message) =>
      this.slotDispatcher.register({
        pluginId: plugin.pluginId,
        name: message.name,
        cacheKey: message.cacheKey,
        batch: message.batch === true,
        invoke: (payload) => plugin.call(message.handlerId, payload),
      }),
    );
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

    this.pluginBridge.addHostMethod(
      "updateModal",
      (plugin, { modalId, title, content }) => {
        updatePluginModal({
          pluginRenderer: this.getRenderer(plugin.pluginId),
          pluginId: plugin.pluginId,
          modalId,
          title,
          content,
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
      return this.localDataStore.get(plugin.pluginId);
    });

    this.pluginBridge.addHostMethod("saveLocalData", (plugin, { data }) => {
      this.localDataStore.set(plugin.pluginId, data);
    });

    this.pluginBridge.addHostMethod(
      "getBinaryCacheEntry",
      async (plugin, { key }) => {
        requireArg("getBinaryCacheEntry", "key", key);
        return await this.binaryCache.get(plugin.pluginId, key);
      },
    );

    this.pluginBridge.addHostMethod(
      "hasBinaryCacheEntry",
      async (plugin, { key }) => {
        requireArg("hasBinaryCacheEntry", "key", key);
        return await this.binaryCache.has(plugin.pluginId, key);
      },
    );

    this.pluginBridge.addHostMethod(
      "listBinaryCacheEntries",
      async (plugin) => {
        return await this.binaryCache.keys(plugin.pluginId);
      },
    );

    this.pluginBridge.addHostMethod(
      "putBinaryCacheEntry",
      async (plugin, { key, data }) => {
        requireArg("putBinaryCacheEntry", "key", key);
        requireArg("putBinaryCacheEntry", "data", data);
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("putBinaryCacheEntry data must be an ArrayBuffer");
        }
        await this.binaryCache.put(plugin.pluginId, key, data);
      },
    );

    this.pluginBridge.addHostMethod(
      "deleteBinaryCacheEntry",
      async (plugin, { key }) => {
        requireArg("deleteBinaryCacheEntry", "key", key);
        await this.binaryCache.delete(plugin.pluginId, key);
      },
    );

    this.pluginBridge.addHostMethod(
      "refreshSettingTab",
      (plugin, { reset = false } = {}) => {
        const tab = this.$settingTabs.get(plugin.pluginId);
        tab?.customContent.refresh({ reset });
      },
    );

    this.pluginBridge.addHostMethod("openPage", (plugin, { pageId } = {}) => {
      requireArg("openPage", "pageId", pageId);
      const encodedPluginId = encodeURIComponent(plugin.pluginId);
      const encodedPageId = encodeURIComponent(pageId);
      this.router.go(`/plugin/${encodedPluginId}/pages/${encodedPageId}`);
    });

    this.pluginBridge.addHostMethod(
      "refreshPage",
      (plugin, { pageId, reset = false } = {}) => {
        requireArg("refreshPage", "pageId", pageId);
        const page = this.getPage(plugin.pluginId, pageId);
        page?.customContent.refresh({ reset });
      },
    );

    this.pluginBridge.addHostMethod("refreshSlot", (plugin, { name, keys }) => {
      this.slotDispatcher.refresh(plugin.pluginId, name, keys);
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
      const permissions = this.permissionsManager.getPermissionsForPlugin(
        plugin.pluginId,
      );
      return this.pluginRequests.pluginFetch(permissions, url, init);
    });

    this.pluginBridge.addHostMethod(
      "requestFetchPermission",
      (plugin, { url }) =>
        this.permissionsManager.requestFetchPermission(plugin.pluginId, url),
    );

    this.pluginBridge.addHostMethod("getUserGrantedFetchOrigins", (plugin) =>
      this.permissionsManager.getUserGrantedFetchOrigins(plugin.pluginId),
    );

    this.pluginDataProvider.registerHostMethods(this.pluginBridge);

    this.pluginBridge.addHostMethod(
      "muteActor",
      async (plugin, { did, mute = true }) => {
        this._requireSignedIn();
        this.permissionsManager.requireActionPermission(plugin, "mute");
        requireArg("muteActor", "did", did);
        const profile = await this._dataLayer.declarative.ensureProfile(did);
        if (mute) await this._dataLayer.mutations.muteProfile(profile);
        else await this._dataLayer.mutations.unmuteProfile(profile);
      },
    );

    this.pluginBridge.addHostMethod(
      "blockActor",
      async (plugin, { did, block = true }) => {
        this._requireSignedIn();
        this.permissionsManager.requireActionPermission(plugin, "block");
        requireArg("blockActor", "did", did);
        const profile = await this._dataLayer.declarative.ensureProfile(did);
        if (block) await this._dataLayer.mutations.blockProfile(profile);
        else await this._dataLayer.mutations.unblockProfile(profile);
      },
    );

    this.pluginBridge.addHostMethod(
      "showLessLikeThis",
      async (plugin, { postUri, feedUri = null }) => {
        this._requireSignedIn();
        this.permissionsManager.requireActionPermission(plugin, "feedFeedback");
        requireArg("showLessLikeThis", "postUri", postUri);
        requireArg("showLessLikeThis", "feedUri", feedUri);
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
        this.permissionsManager.requireActionPermission(plugin, "feedFeedback");
        requireArg("showMoreLikeThis", "postUri", postUri);
        requireArg("showMoreLikeThis", "feedUri", feedUri);
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
    const feed = this._dataLayer.getCachedFeed(feedUri);
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

  async loadEnabledPlugins() {
    try {
      await this._loadEnabledPlugins();
    } finally {
      this._completeInitialLoad();
    }
  }

  _completeInitialLoad() {
    this.$initialLoadComplete.set(true);
    this._resolveInitialLoad();
  }

  async _loadEnabledPlugins() {
    if (arePluginsDisabledByQueryParam()) {
      const enabledPlugins = await this.prefManager.getEnabledPlugins();
      const enabledPluginIds = enabledPlugins.map((entry) => entry.id);
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
    const allEnabledPlugins = await this.prefManager.getEnabledPlugins();
    const enabledPlugins = allEnabledPlugins.filter(
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
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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
    const permissions =
      this.permissionsManager.getManifestPermissions(manifest);
    if (!permissions.isEmpty()) {
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
      permissions: permissions.toJSON(),
    });
  }

  async checkForUpdates() {
    // Load listings first to ensure we have the latest repo URLs for plugins
    await this.loadRegistryListings();
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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
    const installedPlugin = await this.prefManager.getInstalledPlugin(pluginId);
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
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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
    const permissions =
      this.permissionsManager.getManifestPermissions(manifest);
    if (!permissions.isEmpty()) {
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
      permissions: permissions.toJSON(),
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
    const permissions =
      this.permissionsManager.getManifestPermissions(manifest);
    if (!permissions.isEmpty()) {
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
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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
      permissions: permissions.toJSON(),
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
    this.localDataStore.clear(pluginId);
    await this.binaryCache.clear(pluginId);
    const installedPlugins = await this.prefManager.getInstalledPlugins();
    await this._reconcileCache(installedPlugins);
  }

  async enablePlugin(pluginId) {
    await this.prefManager.setPluginEnabled(pluginId);
    const installedPlugin = await this.prefManager.getInstalledPlugin(pluginId);
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
    const installedPlugin = await this.prefManager.getInstalledPlugin(pluginId);
    if (!installedPlugin) return null;
    const liveManifest = await this.sourceProvider.getLiveManifest(
      pluginId,
      installedPlugin.repo,
    );
    if (compareVersions(liveManifest.version, installedPlugin.version) > 0) {
      const { permissions, permissionsDiff } =
        this.permissionsManager.getPermissionsUpdate(pluginId, liveManifest);
      if (permissionsDiff) {
        const accepted = await showPluginUpdatePermissionsModal({
          pluginName: liveManifest.name,
          pluginVersion: liveManifest.version,
          permissionsDiff,
        });
        if (!accepted) throw new PermissionsDeclinedError();
      }
      const { name, version, author, description } = liveManifest;
      const keepUserGrantedFetch = permissions.allowsUserFetch();
      await this.prefManager.updateInstalledPlugin(pluginId, (entry) => {
        const next = {
          ...entry,
          name,
          version,
          author,
          description,
          permissions: permissions.toJSON(),
        };
        // Drop stored grants when the new manifest no longer requests
        // userFetch, so a later manifest that re-adds the scope starts fresh.
        if (!keepUserGrantedFetch && next.userGrantedFetchOrigins) {
          delete next.userGrantedFetchOrigins;
        }
        return next;
      });
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
    const installedPlugins = await this.prefManager.getInstalledPlugins();
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

  getPreviewPlugins() {
    if (!this.isPreviewMode) return [];
    return this.$pluginsInfo
      .get()
      .filter((plugin) => this.pluginBridge.isLoaded(plugin.id));
  }

  getSidebarItems() {
    return [...this.registries.sidebarItems];
  }

  // Slot consumers (<plugin-slot>) are handed the service, not the dispatcher
  get $slots() {
    return this.slotDispatcher.$slots;
  }

  getSlotRegistrations(name) {
    return this.slotDispatcher.getRegistrations(name);
  }

  getSettingTabs() {
    return [...this.$settingTabs.values()];
  }

  getSettingTab(pluginId) {
    return this.$settingTabs.get(pluginId);
  }

  getPage(pluginId, pageId) {
    return this.$pages.get(createPluginPageKey(pluginId, pageId));
  }

  // Until the initial enabled-plugins load has settled, report every plugin
  // as loading so views show a spinner instead of a premature not-found
  getPluginLoadStatus(pluginId) {
    const status = this.pluginBridge.$loadStatuses.get(pluginId);
    return {
      loading: status.loading || !this.$initialLoadComplete.get(),
      error: status.error,
    };
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
    const cachedFeeds = feedURI
      ? [{ uri: feedURI, feed: this._dataLayer.getCachedFeed(feedURI) }]
      : this._dataLayer.getCachedFeeds();
    await Promise.all(
      cachedFeeds.map(async ({ uri, feed }) => {
        if (!feed) return;
        const overrides = await this.getFilteredFeedItems(uri, feed);
        this._hiddenFeedItemsStore.replace(uri, overrides);
      }),
    );
  }

  // Rich-text consumers (<plugin-rich-text>) are handed the service, not
  // the dispatcher

  get $richTextTransformsVersion() {
    return this.richTextDispatcher.$version;
  }

  getClaimedFacetTypes() {
    return this.richTextDispatcher.getClaimedFacetTypes();
  }

  transformRichTextTokens(tokens, context) {
    return this.richTextDispatcher.transformTokens(tokens, context);
  }

  renderRichTextNodeToken(token, host) {
    return this.richTextDispatcher.renderNodeToken(token, host);
  }
}
