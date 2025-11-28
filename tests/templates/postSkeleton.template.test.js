import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";

const t = new TestSuite("postSkeletonTemplate");

t.describe("postSkeletonTemplate", (it) => {
  it("should render skeleton", () => {
    const result = postSkeletonTemplate();
    assert(result instanceof Object);
  });
});

await t.run();
