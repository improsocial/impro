const SLOW_TEST_THRESHOLD_MS = 250;

export class TestSuite {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.tests = [];
    this._beforeEach = null;
    this._afterEach = null;
  }

  beforeEach(fn) {
    this._beforeEach = fn;
  }

  afterEach(fn) {
    this._afterEach = fn;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  describe(namespace, callback) {
    let scopedBeforeEach = null;
    let scopedAfterEach = null;
    const it = (name, fn) => {
      this.tests.push({
        name: `${namespace} > ${name}`,
        fn,
        beforeEach: () => scopedBeforeEach,
        afterEach: () => scopedAfterEach,
      });
    };
    const beforeEach = (fn) => {
      scopedBeforeEach = fn;
    };
    const afterEach = (fn) => {
      scopedAfterEach = fn;
    };
    callback(it, { beforeEach, afterEach });
  }

  async run() {
    const results = [];
    console.info(`Running test suite "${this.suiteName}"...`);
    for (const test of this.tests) {
      console.info(`   ${this.suiteName} > ${test.name}`);
      const scopedBeforeEach = test.beforeEach?.();
      const scopedAfterEach = test.afterEach?.();
      const startTime = performance.now();
      try {
        if (this._beforeEach) {
          await this._beforeEach();
        }
        if (scopedBeforeEach) {
          await scopedBeforeEach();
        }
        await test.fn();
        const durationMs = performance.now() - startTime;
        console.info("   ✅ Passed");
        results.push({ name: test.name, success: true, durationMs });
      } catch (error) {
        const durationMs = performance.now() - startTime;
        console.error("   ❌ Failed");
        console.error(error);
        results.push({
          name: test.name,
          success: false,
          error: error.message,
          durationMs,
        });
      } finally {
        const lastResult = results[results.length - 1];
        if (lastResult?.durationMs >= SLOW_TEST_THRESHOLD_MS) {
          console.warn(`   ⚠️  slow (${lastResult.durationMs.toFixed(0)}ms)`);
        }
        if (scopedAfterEach) {
          await scopedAfterEach();
        }
        if (this._afterEach) {
          await this._afterEach();
        }
      }
    }
    const numPassed = results.filter((result) => result.success).length;
    const numFailed = results.filter((result) => !result.success).length;
    console.info(`${numPassed} passed, ${numFailed} failed`);
    const success = numFailed === 0;
    if (!success) {
      throw new Error(`Test suite "${this.suiteName}" failed`);
    }
  }
}
