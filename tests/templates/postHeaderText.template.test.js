import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { post } from "../fixtures.js";

const t = new TestSuite("postHeaderTextTemplate");

t.describe("postHeaderTextTemplate", (it) => {
  it("should render header with time", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.record.createdAt,
      includeTime: true,
    });
    assert(result instanceof Object);
  });

  it("should render header without time", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.record.createdAt,
      includeTime: false,
    });
    assert(result instanceof Object);
  });

  it("should render header with default includeTime", () => {
    const result = postHeaderTextTemplate({
      author: post.author,
      timestamp: post.record.createdAt,
    });
    assert(result instanceof Object);
  });
});

await t.run();
