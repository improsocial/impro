import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PluginLocalDataStore,
  PluginMemoryDataStore,
} from "/js/plugins/pluginLocalDataStore.js";

const DID_ONE = "did:plc:user-one";
const DID_TWO = "did:plc:user-two";

describe("PluginLocalDataStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been stored", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    assert.deepEqual(store.get("a"), null);
  });

  it("round-trips arbitrary JSON data", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    const data = { keys: [{ id: "k1", label: "personal", secret: "shh" }] };
    store.set("a", data);
    assert.deepEqual(store.get("a"), data);
  });

  it("isolates data between plugin ids", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    store.set("a", { value: 1 });
    store.set("b", { value: 2 });
    assert.deepEqual(store.get("a"), { value: 1 });
    assert.deepEqual(store.get("b"), { value: 2 });
  });

  it("isolates data between account dids", () => {
    const storeOne = new PluginLocalDataStore(DID_ONE);
    const storeTwo = new PluginLocalDataStore(DID_TWO);
    storeOne.set("a", { secret: "one" });
    assert.deepEqual(storeTwo.get("a"), null);
    storeTwo.set("a", { secret: "two" });
    assert.deepEqual(storeOne.get("a"), { secret: "one" });
    assert.deepEqual(storeTwo.get("a"), { secret: "two" });
  });

  it("clear removes only that plugin's entry for that account", () => {
    const storeOne = new PluginLocalDataStore(DID_ONE);
    const storeTwo = new PluginLocalDataStore(DID_TWO);
    storeOne.set("a", { value: 1 });
    storeOne.set("b", { value: 2 });
    storeTwo.set("a", { value: 3 });
    storeOne.clear("a");
    assert.deepEqual(storeOne.get("a"), null);
    assert.deepEqual(storeOne.get("b"), { value: 2 });
    assert.deepEqual(storeTwo.get("a"), { value: 3 });
  });

  it("overwrites previously stored data", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    store.set("a", { value: 1 });
    store.set("a", { value: 2 });
    assert.deepEqual(store.get("a"), { value: 2 });
  });

  it("returns null instead of throwing on corrupted stored data", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    localStorage.setItem(`improPluginLocalData:${DID_ONE}:a`, "{not json");
    assert.deepEqual(store.get("a"), null);
  });

  it("clear is a no-op when nothing was stored", () => {
    const store = new PluginLocalDataStore(DID_ONE);
    assert.doesNotThrow(() => store.clear("never-stored"));
  });
});

describe("PluginMemoryDataStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips data without touching localStorage", () => {
    const store = new PluginMemoryDataStore();
    store.set("a", { value: "anon" });
    assert.deepEqual(store.get("a"), { value: "anon" });
    assert.deepEqual(localStorage.length, 0);
  });

  it("returns null when nothing has been stored", () => {
    const store = new PluginMemoryDataStore();
    assert.deepEqual(store.get("a"), null);
  });

  it("isolates data between store instances", () => {
    const storeOne = new PluginMemoryDataStore();
    storeOne.set("a", { value: 1 });
    assert.deepEqual(new PluginMemoryDataStore().get("a"), null);
  });

  it("clear removes only that plugin's entry", () => {
    const store = new PluginMemoryDataStore();
    store.set("a", { value: 1 });
    store.set("b", { value: 2 });
    store.clear("a");
    assert.deepEqual(store.get("a"), null);
    assert.deepEqual(store.get("b"), { value: 2 });
  });
});
