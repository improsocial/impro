import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PluginCustomEndpointStore,
  PluginCustomEndpointMemoryStore,
} from "/js/plugins/pluginCustomEndpointStore.js";

const DID_ONE = "did:plc:user-one";
const DID_TWO = "did:plc:user-two";

describe("PluginCustomEndpointStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been approved", () => {
    const store = new PluginCustomEndpointStore(DID_ONE);
    assert.deepEqual(store.get("plugin-a"), null);
  });

  it("round-trips an approved URL", () => {
    const store = new PluginCustomEndpointStore(DID_ONE);
    store.set("plugin-a", "http://localhost:11434/api/chat");
    assert.deepEqual(store.get("plugin-a"), "http://localhost:11434/api/chat");
  });

  it("isolates approvals between plugin ids", () => {
    const store = new PluginCustomEndpointStore(DID_ONE);
    store.set("plugin-a", "http://localhost:11434/x");
    store.set("plugin-b", "http://localhost:8080/y");
    assert.deepEqual(store.get("plugin-a"), "http://localhost:11434/x");
    assert.deepEqual(store.get("plugin-b"), "http://localhost:8080/y");
  });

  it("isolates approvals between account dids", () => {
    const storeOne = new PluginCustomEndpointStore(DID_ONE);
    const storeTwo = new PluginCustomEndpointStore(DID_TWO);
    storeOne.set("plugin-a", "http://localhost:11434/x");
    assert.deepEqual(storeTwo.get("plugin-a"), null);
  });

  it("clear removes the approval", () => {
    const store = new PluginCustomEndpointStore(DID_ONE);
    store.set("plugin-a", "http://localhost:11434/x");
    store.clear("plugin-a");
    assert.deepEqual(store.get("plugin-a"), null);
  });
});

describe("PluginCustomEndpointMemoryStore", () => {
  it("round-trips within a session without touching localStorage", () => {
    const store = new PluginCustomEndpointMemoryStore();
    assert.deepEqual(store.get("plugin-a"), null);
    store.set("plugin-a", "http://localhost:11434/x");
    assert.deepEqual(store.get("plugin-a"), "http://localhost:11434/x");
    store.clear("plugin-a");
    assert.deepEqual(store.get("plugin-a"), null);
  });
});
