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
    const it = (name, fn) => {
      this.tests.push({ name: `${namespace} > ${name}`, fn });
    };
    callback(it);
  }

  async run() {
    const results = [];
    console.info(`Running test suite "${this.suiteName}"...`);
    for (const test of this.tests) {
      console.info(`   ${this.suiteName} > ${test.name}`);
      try {
        if (this._beforeEach) {
          await this._beforeEach();
        }
        await test.fn();
        console.info("   ✅ Passed");
        results.push({ name: test.name, success: true });
      } catch (error) {
        console.error("   ❌ Failed");
        console.error(error);
        results.push({ name: test.name, success: false, error: error.message });
      } finally {
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
