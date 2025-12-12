import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { post } from "../fixtures.js";

const noop = () => {};
const postInteractionHandler = {
  isAuthenticated: true,
  handleLike: noop,
  handleRepost: noop,
  handleQuotePost: noop,
  handleBookmark: noop,
  handleMuteAuthor: noop,
  handleBlockAuthor: noop,
  handleDeletePost: noop,
};

const t = new TestSuite("largePostTemplate");

t.describe("largePostTemplate", (it) => {
  it("should render the post", () => {
    const result = largePostTemplate({ post, postInteractionHandler });
    assert(result instanceof Object);
  });

  it("should render with reply context", () => {
    const result = largePostTemplate({
      post,
      postInteractionHandler,
      replyContext: "parent",
    });
    assert(result instanceof Object);
  });
});

await t.run();
