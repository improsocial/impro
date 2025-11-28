import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { post } from "../fixtures.js";

const t = new TestSuite("smallPostTemplate");

t.describe("smallPostTemplate", (it) => {
  it("should render the post", () => {
    const result = smallPostTemplate({
      post: post,
    });
    assert(result instanceof Object);
  });
});

await t.run();
