import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { post } from "../fixtures.js";

const t = new TestSuite("largePostTemplate");

t.describe("largePostTemplate", (it) => {
  it("should render the post", () => {
    const result = largePostTemplate({ post });
    assert(result instanceof Object);
  });

  it("should render with enableClick disabled", () => {
    const result = largePostTemplate({ post, enableClick: false });
    assert(result instanceof Object);
  });

  it("should render with reply context", () => {
    const result = largePostTemplate({ post, replyContext: "parent" });
    assert(result instanceof Object);
  });
});

await t.run();
