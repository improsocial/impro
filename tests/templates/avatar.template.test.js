import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { post } from "../fixtures.js";

const t = new TestSuite("avatarTemplate");

t.describe("avatarTemplate", (it) => {
  it("should render avatar with author info", () => {
    const result = avatarTemplate({ author: post.author });
    assert(result instanceof Object);
  });

  it("should render avatar without avatar URL", () => {
    const author = { ...post.author, avatar: null };
    const result = avatarTemplate({ author });
    assert(result instanceof Object);
  });
});

await t.run();
