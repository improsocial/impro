import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { post } from "../../fixtures.js";

const t = new TestSuite("postActionBarTemplate");

t.describe("postActionBarTemplate", (it) => {
  it("should render action bar", () => {
    const result = postActionBarTemplate({
      post,
      isLiked: false,
      numLikes: 10,
      onClickLike: () => {},
    });
    assert(result instanceof Object);
  });

  it("should render action bar with liked state", () => {
    const result = postActionBarTemplate({
      post,
      isLiked: true,
      numLikes: 10,
      onClickLike: () => {},
    });
    assert(result instanceof Object);
  });
});

await t.run();
