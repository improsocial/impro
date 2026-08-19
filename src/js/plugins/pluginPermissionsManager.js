import { showPluginFetchPermissionModal } from "/js/plugins/pluginModal.js";
import { Permissions } from "/js/plugins/pluginPermissions.js";

export class PluginPermissionsManager {
  constructor({ prefManager }) {
    this.prefManager = prefManager;
    this._pendingFetchPermissionRequests = new Set();
  }

  getPermissionsForPlugin(pluginId) {
    const permissions = this.getStoredPermissions(pluginId);
    if (!permissions.allowsUserFetch()) return permissions;
    return permissions.withFetchOrigins(
      this.getUserGrantedFetchOrigins(pluginId),
    );
  }

  // The manifest-declared grant as stored on the preferences entry, WITHOUT
  // user-granted fetch origins.
  getStoredPermissions(pluginId) {
    const entry = this.prefManager.$installedPlugin.get(pluginId);
    return Permissions.parse(entry?.permissions ?? {});
  }

  getManifestPermissions(manifest) {
    return Permissions.fromManifest(manifest);
  }

  // Consent data for updating to a new manifest: the manifest's parsed
  // grant (stored on accept) and what it adds over the already-consented
  // permissions (what the user must approve), or null when nothing new.
  // Diffs against the stored manifest grant, never the merged one — merging
  // would make a manifest newly requesting an origin the user already
  // granted ad hoc diff to nothing.
  getPermissionsUpdate(pluginId, manifest) {
    const permissions = this.getManifestPermissions(manifest);
    const permissionsDiff =
      this.getStoredPermissions(pluginId).diff(permissions);
    return { permissions, permissionsDiff };
  }

  getUserGrantedFetchOrigins(pluginId) {
    return this.prefManager.getUserGrantedFetchOrigins(pluginId);
  }

  hasUserGrantedFetchOrigins(pluginId) {
    return this.getUserGrantedFetchOrigins(pluginId).length > 0;
  }

  requireActionPermission(plugin, action) {
    const permissions = this.getPermissionsForPlugin(plugin.pluginId);
    if (!permissions.allowsAction(action)) {
      throw new Error(
        `"${plugin.pluginId}" does not have "${action}" action permission`,
      );
    }
  }

  async requestFetchPermission(pluginId, url) {
    const entry = this.prefManager.$installedPlugin.get(pluginId);
    if (!this.getStoredPermissions(pluginId).allowsUserFetch()) {
      throw new Error(`"${pluginId}" does not have the "userFetch" permission`);
    }
    const origin = Permissions.normalizeFetchOrigin(url);
    if (!origin) return false;
    if (this.getPermissionsForPlugin(pluginId).hasFetchPattern(origin)) {
      return true;
    }
    if (this._pendingFetchPermissionRequests.has(pluginId)) return false;
    this._pendingFetchPermissionRequests.add(pluginId);
    let granted = false;
    try {
      granted = await showPluginFetchPermissionModal({
        pluginName: entry?.name ?? null,
        origin,
      });
    } finally {
      this._pendingFetchPermissionRequests.delete(pluginId);
    }
    if (!granted) return false;
    await this.prefManager.addUserGrantedFetchOrigin(pluginId, origin);
    return true;
  }

  async revokeUserGrantedFetchOrigin(pluginId, origin) {
    await this.prefManager.removeUserGrantedFetchOrigin(pluginId, origin);
  }
}
