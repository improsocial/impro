class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }

  toString() {
    return `AssertionError: ${this.message}`;
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export function deepEqual(objA, objB) {
  if (objA instanceof Array) {
    return (
      objA.length === objB.length &&
      objA.every((value, index) => deepEqual(value, objB[index]))
    );
  }
  if (objA instanceof Object) {
    return Object.keys(objA).every((key) => deepEqual(objA[key], objB[key]));
  }
  return objA === objB;
}

function prettyPrint(value) {
  if (value instanceof Array || value instanceof Object) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function assertEquals(actual, expected) {
  if (!deepEqual(actual, expected)) {
    throw new AssertionError(`assertEquals failed: 
      expected: ${prettyPrint(expected)}
      actual: ${prettyPrint(actual)}
    `);
  }
}

// Equivalent to jest.fn()
export function mock(fn = () => {}) {
  const calls = [];
  const results = [];
  const mockFn = (...args) => {
    calls.push(args);
    const result = fn(...args);
    results.push(result);
    return result;
  };
  mockFn.calls = calls;
  mockFn.results = results;
  return mockFn;
}
