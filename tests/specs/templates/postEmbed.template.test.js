import { TestSuite } from "../../testSuite.js";
import { assert } from "../../testHelpers.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { post } from "../../fixtures.js";

const t = new TestSuite("postEmbedTemplate");

t.describe("postEmbedTemplate", (it) => {
  it("should render image embed", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        {
          thumb: "https://example.com/image.jpg",
          alt: "Test image",
        },
      ],
    };
    const result = postEmbedTemplate({ embed, labels: [] });
    assert(result instanceof Object);
  });

  it("should render external link embed", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com",
        title: "Example",
        description: "Test description",
        thumb: "https://example.com/thumb.jpg",
      },
    };
    const result = postEmbedTemplate({ embed, labels: [] });
    assert(result instanceof Object);
  });

  it("should render quoted post embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
      },
    };
    const result = postEmbedTemplate({ embed, labels: [] });
    assert(result instanceof Object);
  });

  it("should render blocked quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewBlocked",
        uri: "blocked-uri",
        blocked: true,
      },
    };
    const result = postEmbedTemplate({ embed, labels: [] });
    assert(result instanceof Object);
  });
});

await t.run();
