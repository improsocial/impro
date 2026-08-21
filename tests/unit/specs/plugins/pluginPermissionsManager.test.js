import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginPermissionsManager } from "/js/plugins/pluginPermissionsManager.js";

describe("PluginPermissionsManager", () => {
  function makeManager(entry) {
    const prefManager = {
      $installedPlugin: { get: (pluginId) => entry?.[pluginId] ?? null },
      // The real prefManager sanitizes stored origins (covered in its own
      // spec); the stub hands back the stored patterns as-is.
      getUserGrantedFetchOrigins: (pluginId) =>
        entry?.[pluginId]?.userGrantedFetchOrigins ?? [],
    };
    return new PluginPermissionsManager({ prefManager });
  }

  it("returns the parsed stored permissions", () => {
    const manager = makeManager({
      alpha: {
        permissions: { actions: ["mute"], fetch: ["https://a.example/*"] },
      },
    });
    assert.deepEqual(manager.getPermissionsForPlugin("alpha").toJSON(), {
      actions: ["mute"],
      fetch: ["https://a.example/*"],
    });
  });

  it("returns empty permissions for an unknown plugin", () => {
    const manager = makeManager({});
    assert.deepEqual(manager.getPermissionsForPlugin("missing").toJSON(), {});
  });

  it("merges user-granted fetch origins only when userFetch is granted", () => {
    const withUserFetch = makeManager({
      alpha: {
        permissions: { userFetch: true, fetch: ["https://a.example/*"] },
        userGrantedFetchOrigins: ["https://granted.example/*"],
      },
    });
    assert.deepEqual(withUserFetch.getPermissionsForPlugin("alpha").fetch, [
      "https://a.example/*",
      "https://granted.example/*",
    ]);

    const withoutUserFetch = makeManager({
      alpha: {
        permissions: { fetch: ["https://a.example/*"] },
        userGrantedFetchOrigins: ["https://granted.example/*"],
      },
    });
    assert.deepEqual(withoutUserFetch.getPermissionsForPlugin("alpha").fetch, [
      "https://a.example/*",
    ]);
  });

  it("getStoredPermissions parses the entry grant without merging fetch origins", () => {
    const manager = makeManager({
      alpha: {
        permissions: { userFetch: true, fetch: ["https://a.example/*"] },
        userGrantedFetchOrigins: ["https://granted.example/*"],
      },
    });
    assert.deepEqual(manager.getStoredPermissions("alpha").toJSON(), {
      userFetch: true,
      fetch: ["https://a.example/*"],
    });
    assert.deepEqual(manager.getStoredPermissions("missing").toJSON(), {});
  });

  it("getManifestPermissions parses the manifest's permissions key", () => {
    const manager = makeManager({});
    assert.deepEqual(
      manager
        .getManifestPermissions({
          name: "x",
          permissions: { actions: ["mute", "bogus"] },
        })
        .toJSON(),
      { actions: ["mute"] },
    );
    assert.deepEqual(manager.getManifestPermissions({}).toJSON(), {});
  });

  it("getPermissionsUpdate returns the manifest grant and its additions", () => {
    const manager = makeManager({
      alpha: { permissions: { fetch: ["https://a.example/*"] } },
    });
    const { permissions, permissionsDiff } = manager.getPermissionsUpdate(
      "alpha",
      {
        permissions: {
          fetch: ["https://a.example/*", "https://b.example/*"],
          userFetch: true,
        },
      },
    );
    assert.deepEqual(permissions.toJSON(), {
      fetch: ["https://a.example/*", "https://b.example/*"],
      userFetch: true,
    });
    assert.deepEqual(permissionsDiff, {
      fetch: ["https://b.example/*"],
      userFetch: true,
    });

    const unchanged = manager.getPermissionsUpdate("alpha", {
      permissions: { fetch: ["https://a.example/*"] },
    });
    assert.deepEqual(unchanged.permissionsDiff, null);
  });

  it("getPermissionsUpdate still prompts for an origin the user granted ad hoc", () => {
    const manager = makeManager({
      alpha: {
        permissions: { userFetch: true },
        userGrantedFetchOrigins: ["https://granted.example/*"],
      },
    });
    const { permissionsDiff } = manager.getPermissionsUpdate("alpha", {
      permissions: { userFetch: true, fetch: ["https://granted.example/*"] },
    });
    assert.deepEqual(permissionsDiff, {
      fetch: ["https://granted.example/*"],
    });
  });

  it("hasUserGrantedFetchOrigins reflects whether any grants are stored", () => {
    const manager = makeManager({
      alpha: { userGrantedFetchOrigins: ["https://granted.example/*"] },
      beta: {},
    });
    assert(manager.hasUserGrantedFetchOrigins("alpha"));
    assert(!manager.hasUserGrantedFetchOrigins("beta"));
    assert(!manager.hasUserGrantedFetchOrigins("missing"));
  });

  it("requireActionPermission passes for a granted action", () => {
    const manager = makeManager({
      alpha: { permissions: { actions: ["privateData"] } },
    });
    manager.requireActionPermission({ pluginId: "alpha" }, "privateData");
  });

  it("requireActionPermission throws for a missing action", () => {
    const manager = makeManager({
      alpha: { permissions: { actions: ["mute"] } },
    });
    assert.throws(
      () =>
        manager.requireActionPermission({ pluginId: "alpha" }, "privateData"),
      /"alpha" does not have "privateData" action permission/,
    );
  });
});
