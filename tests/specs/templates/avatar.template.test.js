import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { post } from "../../fixtures.js";

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

t.describe("avatarTemplate - labeler profiles", (it) => {
  it("should render avatar for labeler profile", () => {
    const labelerAuthor = {
      ...post.author,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    assert(result instanceof Object);
  });

  it("should render avatar for non-labeler profile", () => {
    const normalAuthor = {
      ...post.author,
      associated: { labeler: false },
    };
    const result = avatarTemplate({ author: normalAuthor });
    assert(result instanceof Object);
  });

  it("should render avatar when associated is undefined", () => {
    const authorWithoutAssociated = { ...post.author };
    delete authorWithoutAssociated.associated;
    const result = avatarTemplate({ author: authorWithoutAssociated });
    assert(result instanceof Object);
  });

  it("should handle labeler profile with custom avatar URL", () => {
    const labelerAuthor = {
      ...post.author,
      avatar:
        "https://cdn.bsky.app/img/avatar/plain/did:plc:labeler/avatar@jpeg",
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    assert(result instanceof Object);
  });

  it("should handle labeler profile without avatar URL", () => {
    const labelerAuthor = {
      ...post.author,
      avatar: null,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    assert(result instanceof Object);
  });
});

await t.run();
