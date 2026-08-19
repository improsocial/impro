import { requireArg } from "/js/utils.js";

// The read-only data getters exposed to plugins as app.data.*
export class PluginDataProvider {
  constructor({
    dataLayer,
    pluginRequests,
    slingshot,
    constellation,
    session,
  }) {
    this.dataLayer = dataLayer;
    this.pluginRequests = pluginRequests;
    this.slingshot = slingshot;
    this.constellation = constellation;
    this.session = session;
  }

  registerHostMethods(pluginBridge) {
    pluginBridge.addHostMethod("getPost", async (plugin, { uri }) => {
      requireArg("getPost", "uri", uri);
      try {
        return await this.dataLayer.declarative.ensurePost(uri);
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getProfile", async (plugin, { did }) => {
      requireArg("getProfile", "did", did);
      const profile = this.dataLayer.derived.$hydratedProfiles.get(did);
      if (profile) return profile;
      try {
        await this.dataLayer.declarative.ensureDetailedProfile(did);
      } catch {
        return null;
      }
      return this.dataLayer.derived.$hydratedProfiles.get(did) ?? null;
    });

    pluginBridge.addHostMethod(
      "getDetailedProfile",
      async (plugin, { did }) => {
        requireArg("getDetailedProfile", "did", did);
        try {
          return await this.dataLayer.declarative.ensureDetailedProfile(did);
        } catch {
          return null;
        }
      },
    );

    pluginBridge.addHostMethod("getKnownFollowers", async (plugin, { did }) => {
      requireArg("getKnownFollowers", "did", did);
      try {
        return await this.dataLayer.declarative.ensureKnownFollowers(did);
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getPostThread", async (plugin, { uri }) => {
      requireArg("getPostThread", "uri", uri);
      try {
        return await this.dataLayer.declarative.ensurePostThread(uri);
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getList", async (plugin, { uri }) => {
      requireArg("getList", "uri", uri);
      try {
        return await this.dataLayer.declarative.ensureList(uri);
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getFeedGenerator", async (plugin, { uri }) => {
      requireArg("getFeedGenerator", "uri", uri);
      try {
        return await this.dataLayer.declarative.ensureFeedGenerator(uri);
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getCurrentUserProfile", async () => {
      if (!this.session) return null;
      try {
        return await this.dataLayer.declarative.ensureCurrentUser();
      } catch {
        return null;
      }
    });

    pluginBridge.addHostMethod("getCurrentUser", () => {
      if (!this.session) return null;
      return {
        did: this.session.did,
        handle: this.session.handle,
      };
    });

    pluginBridge.addHostMethod(
      "getRecord",
      (plugin, { repo, collection, rkey }) => {
        requireArg("getRecord", "repo", repo);
        requireArg("getRecord", "collection", collection);
        requireArg("getRecord", "rkey", rkey);
        return this.slingshot.getRecord({ repo, collection, rkey });
      },
    );

    pluginBridge.addHostMethod(
      "getBacklinks",
      (plugin, { subject, source, limit }) => {
        requireArg("getBacklinks", "subject", subject);
        requireArg("getBacklinks", "source", source);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
          throw new Error(`getBacklinks: invalid limit "${limit}"`);
        }
        return this.constellation.getLinks({ subject, source, limit });
      },
    );

    pluginBridge.addHostMethod("xrpcQuery", (plugin, { nsid, params }) => {
      requireArg("xrpcQuery", "nsid", nsid);
      return this.pluginRequests.pluginXrpcRequest(plugin, nsid, params);
    });
  }
}
