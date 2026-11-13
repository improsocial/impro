import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { Signal, SignalMap, SignalSet, SignalArray } from "/js/signals.js";

const KEYS = ["a", "b", "c"];

const keyArbitrary = fc.constantFrom(...KEYS);
const valueArbitrary = fc.integer({ min: 0, max: 3 });

// Each step mutates, then reads only some of the computeds, so the rest stay
// cached across several mutations before they are next checked.
function stepsArbitrary(operationArbitrary, readerCount) {
  return fc.array(
    fc.record({
      operation: operationArbitrary,
      readersToCheck: fc.array(fc.boolean(), {
        minLength: readerCount,
        maxLength: readerCount,
      }),
    }),
    { maxLength: 30 },
  );
}

function runSteps(steps, readers, applyOperation) {
  const computeds = readers.map(
    (reader) => new Signal.Computed(() => reader.read()),
  );
  const checkReaders = (shouldCheck) => {
    readers.forEach((reader, index) => {
      if (!shouldCheck[index]) return;
      assert.deepEqual(computeds[index].get(), reader.expected());
    });
  };
  checkReaders(readers.map(() => true));
  for (const step of steps) {
    applyOperation(step.operation);
    checkReaders(step.readersToCheck);
  }
  checkReaders(readers.map(() => true));
}

const mapOperationArbitrary = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("set"),
      key: keyArbitrary,
      value: valueArbitrary,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ type: fc.constant("delete"), key: keyArbitrary }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("clear") }) },
);

const setOperationArbitrary = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({ type: fc.constant("add"), value: keyArbitrary }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ type: fc.constant("delete"), value: keyArbitrary }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("clear") }) },
);

const indexArbitrary = fc.integer({ min: -2, max: 6 });

const arrayOperationArbitrary = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("push"),
      values: fc.array(valueArbitrary, { maxLength: 3 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ type: fc.constant("pop") }) },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant("set"),
      index: fc.integer({ min: 0, max: 6 }),
      value: valueArbitrary,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant("splice"),
      start: indexArbitrary,
      deleteCount: fc.integer({ min: 0, max: 3 }),
      items: fc.array(valueArbitrary, { maxLength: 3 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("replace"),
      values: fc.array(valueArbitrary, { maxLength: 5 }),
    }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant("clear") }) },
);

describe("signal collection properties", () => {
  it("SignalMap readers always match a plain Map", () => {
    const readerCount = KEYS.length * 2 + 2;
    fc.assert(
      fc.property(
        fc.array(fc.tuple(keyArbitrary, valueArbitrary), { maxLength: 3 }),
        stepsArbitrary(mapOperationArbitrary, readerCount),
        (initialEntries, steps) => {
          const signalMap = new SignalMap(initialEntries);
          const model = new Map(initialEntries);
          const readers = [
            ...KEYS.map((key) => ({
              read: () => signalMap.get(key),
              expected: () => model.get(key) ?? null,
            })),
            ...KEYS.map((key) => ({
              read: () => signalMap.has(key),
              expected: () => model.has(key),
            })),
            { read: () => signalMap.size, expected: () => model.size },
            {
              read: () => [...signalMap.entries()],
              expected: () => [...model.entries()],
            },
          ];
          runSteps(steps, readers, (operation) => {
            for (const target of [signalMap, model]) {
              if (operation.type === "set") {
                target.set(operation.key, operation.value);
              } else if (operation.type === "delete") {
                target.delete(operation.key);
              } else {
                target.clear();
              }
            }
          });
        },
      ),
      { numRuns: 300 },
    );
  });

  it("SignalSet readers always match a plain Set", () => {
    const readerCount = KEYS.length + 2;
    fc.assert(
      fc.property(
        fc.array(keyArbitrary, { maxLength: 3 }),
        stepsArbitrary(setOperationArbitrary, readerCount),
        (initialValues, steps) => {
          const signalSet = new SignalSet(initialValues);
          const model = new Set(initialValues);
          const readers = [
            ...KEYS.map((value) => ({
              read: () => signalSet.has(value),
              expected: () => model.has(value),
            })),
            { read: () => signalSet.size, expected: () => model.size },
            {
              read: () => [...signalSet.values()],
              expected: () => [...model.values()],
            },
          ];
          runSteps(steps, readers, (operation) => {
            for (const target of [signalSet, model]) {
              if (operation.type === "add") {
                target.add(operation.value);
              } else if (operation.type === "delete") {
                target.delete(operation.value);
              } else {
                target.clear();
              }
            }
          });
        },
      ),
      { numRuns: 300 },
    );
  });

  it("SignalArray readers always match a plain Array", () => {
    const readerCount = 6;
    fc.assert(
      fc.property(
        fc.array(valueArbitrary, { maxLength: 4 }),
        stepsArbitrary(arrayOperationArbitrary, readerCount),
        (initialValues, steps) => {
          const signalArray = new SignalArray(initialValues);
          let model = [...initialValues];
          const readers = [
            { read: () => signalArray.length, expected: () => model.length },
            { read: () => [...signalArray], expected: () => [...model] },
            { read: () => signalArray.at(-1), expected: () => model.at(-1) },
            {
              read: () => signalArray.includes(1),
              expected: () => model.includes(1),
            },
            {
              read: () => signalArray.indexOf(2),
              expected: () => model.indexOf(2),
            },
            {
              read: () => signalArray.filter((value) => value > 1),
              expected: () => model.filter((value) => value > 1),
            },
          ];
          runSteps(steps, readers, (operation) => {
            if (operation.type === "push") {
              signalArray.push(...operation.values);
              model.push(...operation.values);
            } else if (operation.type === "pop") {
              assert.deepEqual(signalArray.pop(), model.pop());
            } else if (operation.type === "set") {
              signalArray.set(operation.index, operation.value);
              model[operation.index] = operation.value;
            } else if (operation.type === "splice") {
              const { start, deleteCount, items } = operation;
              assert.deepEqual(
                signalArray.splice(start, deleteCount, ...items),
                model.splice(start, deleteCount, ...items),
              );
            } else if (operation.type === "replace") {
              signalArray.replace(operation.values);
              model = [...operation.values];
            } else {
              signalArray.clear();
              model.length = 0;
            }
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});
