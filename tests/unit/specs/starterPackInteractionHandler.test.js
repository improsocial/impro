import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { StarterPackInteractionHandler } from "/js/starterPackInteractionHandler.js";
import {
  makeTestDataLayer,
  respondToConfirm,
  waitFor,
} from "../testHelpers.js";

describe("StarterPackInteractionHandler opt-out", () => {
  const list = {
    uri: "at://did:plc:creator/app.bsky.graph.list/pack",
    viewer: {},
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function makeHandler(mutationImpl) {
    const dataLayer = makeTestDataLayer();
    const calls = [];
    dataLayer.mutations.optOutOfReferenceList = async (arg) => {
      calls.push(arg);
      return mutationImpl();
    };
    dataLayer.mutations.undoReferenceListOptOut = async (arg) => {
      calls.push(arg);
      return mutationImpl();
    };
    return { handler: new StarterPackInteractionHandler(dataLayer), calls };
  }

  it("does not mutate when the confirm is cancelled", async () => {
    const { handler, calls } = makeHandler(async () => {});

    const promise = handler.handleOptOut(list);
    await respondToConfirm(false);

    assert.deepEqual(await promise, false);
    assert.deepEqual(calls, []);
  });

  it("opts out on confirm and toasts", async () => {
    const { handler, calls } = makeHandler(async () => {});

    const promise = handler.handleOptOut(list);
    await respondToConfirm(true);

    assert.deepEqual(await promise, true);
    assert.deepEqual(calls, [list]);
    await waitFor(() => document.querySelector('[data-testid="toast"]'));
    assert(!document.querySelector('[data-testid="toast"].error'));
  });

  it("undoes on confirm and toasts", async () => {
    const { handler, calls } = makeHandler(async () => {});

    const promise = handler.handleUndoOptOut(list);
    await respondToConfirm(true);

    assert.deepEqual(await promise, true);
    assert.deepEqual(calls, [list]);
    await waitFor(() => document.querySelector('[data-testid="toast"]'));
  });

  it("keeps the modal open and toasts an error when the mutation fails", async () => {
    const { handler } = makeHandler(async () => {
      throw new Error("nope");
    });

    const promise = handler.handleOptOut(list);
    await respondToConfirm(true);
    await waitFor(() => document.querySelector('[data-testid="toast"].error'));

    assert(document.querySelector('[data-testid="confirm-modal"]'));
    await respondToConfirm(false);
    assert.deepEqual(await promise, false);
  });
});
