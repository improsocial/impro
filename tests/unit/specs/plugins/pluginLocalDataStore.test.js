import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getLocalData,
  setLocalData,
  clearLocalData,
} from "/js/plugins/pluginLocalDataStore.js";

describe("pluginLocalDataStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been stored", () => {
    assert.deepEqual(getLocalData("a"), null);
  });

  it("round-trips arbitrary JSON data", () => {
    const data = { keys: [{ id: "k1", label: "personal", secret: "shh" }] };
    setLocalData("a", data);
    assert.deepEqual(getLocalData("a"), data);
  });

  it("isolates data between plugin ids", () => {
    setLocalData("a", { value: 1 });
    setLocalData("b", { value: 2 });
    assert.deepEqual(getLocalData("a"), { value: 1 });
    assert.deepEqual(getLocalData("b"), { value: 2 });
  });

  it("clearLocalData removes only that plugin's entry", () => {
    setLocalData("a", { value: 1 });
    setLocalData("b", { value: 2 });
    clearLocalData("a");
    assert.deepEqual(getLocalData("a"), null);
    assert.deepEqual(getLocalData("b"), { value: 2 });
  });

  it("overwrites previously stored data", () => {
    setLocalData("a", { value: 1 });
    setLocalData("a", { value: 2 });
    assert.deepEqual(getLocalData("a"), { value: 2 });
  });

  it("returns null instead of throwing on corrupted stored data", () => {
    localStorage.setItem("improPluginLocalData:a", "{not json");
    assert.deepEqual(getLocalData("a"), null);
  });

  it("clearLocalData is a no-op when nothing was stored", () => {
    assert.doesNotThrow(() => clearLocalData("never-stored"));
  });
});
