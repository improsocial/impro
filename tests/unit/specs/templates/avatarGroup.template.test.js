import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avatarGroupTemplate } from "/js/templates/avatarGroup.template.js";
import { render } from "/js/lib/lit-html.js";
import { createProfile } from "../../../shared/factories.js";

describe("avatarGroupTemplate", () => {
  function renderTemplate(authors) {
    const container = document.createElement("div");
    render(avatarGroupTemplate({ authors }), container);
    return container;
  }

  function makeAuthors(count) {
    return Array.from({ length: count }, (_unused, index) =>
      createProfile({
        did: `did:plc:member${index}`,
        handle: `member${index}.bsky.social`,
        displayName: `Member ${index}`,
      }),
    );
  }

  it("should render a placeholder inside the group wrapper when there are no authors", () => {
    const container = renderTemplate([]);
    const group = container.querySelector(".avatar-group");
    assert(group !== null);
    assert(group.querySelector(".avatar-placeholder") !== null);
  });

  it("should render a single avatar without the group wrapper", () => {
    const container = renderTemplate(makeAuthors(1));
    assert(container.querySelector(".avatar-group") === null);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should stack at most four avatars", () => {
    const container = renderTemplate(makeAuthors(6));
    const group = container.querySelector("[data-testid='avatar-group']");
    assert(group.classList.contains("avatar-group-4"));
    assert.equal(group.querySelectorAll(".avatar-group-item").length, 4);
  });
});
