import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "/js/preferences.js";
import { Labeling } from "/js/labeling.js";

describe("Labeling.getBadgeLabelsForPost", () => {
  it("should return empty array when post has no labels", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = { labels: [] };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result, []);
  });

  it("should return badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "verified");
    assert.deepEqual(result[0].labeler.creator.did, "did:labeler1");
  });

  it("should skip labels whose labeler definitions are missing", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result, []);
  });

  it("should not return content labels as badges", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
  });

  it("should not return media labels as badges", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nudity",
              blurs: "media",
              locales: [{ lang: "en", name: "Nudity" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nudity" }],
    };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
  });
});

describe("Labeling.getBadgeLabelsForProfile", () => {
  const labelerDefs = [
    {
      creator: { did: "did:labeler1", handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          {
            identifier: "spam",
            blurs: "none",
            severity: "inform",
            locales: [{ lang: "en", name: "Spam" }],
          },
          {
            identifier: "nsfw",
            blurs: "content",
            locales: [{ lang: "en", name: "NSFW" }],
          },
          {
            identifier: "impersonation",
            blurs: "content",
            severity: "alert",
            locales: [{ lang: "en", name: "Impersonation" }],
          },
        ],
      },
    },
  ];

  it("should return empty array when profile has no labels", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const result = labeling.getBadgeLabelsForProfile({ labels: [] });

    assert.deepEqual(result, []);
  });

  it("should return empty array when profile labels are missing", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const result = labeling.getBadgeLabelsForProfile({});

    assert.deepEqual(result, []);
  });

  it("should return badge labels on the profile", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "spam" }],
    };
    const result = labeling.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "spam");
    assert.deepEqual(result[0].labeler.creator.did, "did:labeler1");
  });

  it("should not return blur labels without alert/inform severity", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });

  it("should return blur labels with alert/inform severity", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "impersonation" }],
    };
    const result = labeling.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 1);
    assert.deepEqual(result[0].labelDefinition.identifier, "impersonation");
  });

  it("should not return blur labels as badges on posts", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "impersonation" }],
    };
    const result = labeling.getBadgeLabelsForPost(post);

    assert.deepEqual(result.length, 0);
  });

  it("should skip labels from unknown labelers", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler-unknown", val: "spam" }],
    };
    const result = labeling.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });

  it("should not return labels the user set to ignore", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "spam",
        labelerDid: "did:labeler1",
        visibility: "ignore",
      },
    ];
    const labeling = new Labeling(new Preferences(obj), labelerDefs);
    const profile = {
      labels: [{ src: "did:labeler1", val: "spam" }],
    };
    const result = labeling.getBadgeLabelsForProfile(profile);

    assert.deepEqual(result.length, 0);
  });
});

describe("Labeling.getContentLabel", () => {
  it("should return null when post has no content labels", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = { labels: [] };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result, null);
  });

  it("should return content label with visibility from preference", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nsfw",
        labelerDid: "did:labeler1",
        visibility: "hide",
      },
    ];

    const labeling = new Labeling(new Preferences(obj), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nsfw");
  });

  it("should use defaultSetting when no preference exists", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
  });

  it("should return most restrictive label (hide over warn)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "label1",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Label 1" }],
            },
            {
              identifier: "label2",
              blurs: "content",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Label 2" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [
        { src: "did:labeler1", val: "label1" },
        { src: "did:labeler1", val: "label2" },
      ],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "label2");
  });

  it("should ignore badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result, null);
  });
});

describe("Labeling.getMediaLabel", () => {
  it("should return null when post has no media labels", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = { labels: [] };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result, null);
  });

  it("should return media label with visibility from preference", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nudity_custom",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Nudity" }],
            },
          ],
        },
      },
    ];
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nudity_custom",
        labelerDid: "did:labeler1",
        visibility: "hide",
      },
    ];

    const labeling = new Labeling(new Preferences(obj), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nudity_custom" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nudity_custom");
  });

  it("should ignore content labels (blurs: content)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result, null);
  });

  it("should return most restrictive media label", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "suggestive",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Suggestive" }],
            },
            {
              identifier: "porn",
              blurs: "media",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Porn" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [
        { src: "did:labeler1", val: "suggestive" },
        { src: "did:labeler1", val: "porn" },
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });
});

describe("Labeling.getProfileBlurLabel", () => {
  it("should return null when author has no labels", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const author = { labels: [] };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should return null when author is undefined", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const result = labeling.getProfileBlurLabel(undefined);

    assert.deepEqual(result, null);
  });

  it("should return entry for the !hide global label", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const author = {
      labels: [{ src: "did:plc:author", val: "!hide" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
  });

  it("should return entry for the porn global label (default hide)", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const author = {
      labels: [{ src: "did:plc:author", val: "porn" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });

  it("should return null for nudity (default ignore)", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const author = {
      labels: [{ src: "did:plc:author", val: "nudity" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should respect labeler-defined blur labels when subscribed", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "nsfw",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "NSFW" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const author = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "nsfw");
  });

  it("should skip labeler-defined labels when labeler is not subscribed", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const author = {
      labels: [{ src: "did:labeler1", val: "nsfw" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should skip badge labels (blurs: none)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "verified",
              blurs: "none",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Verified" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const author = {
      labels: [{ src: "did:labeler1", val: "verified" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result, null);
  });

  it("should return the most restrictive label (hide over warn)", () => {
    const labelerDefs = [
      {
        creator: { did: "did:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "soft",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Soft" }],
            },
            {
              identifier: "hard",
              blurs: "media",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Hard" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const author = {
      labels: [
        { src: "did:labeler1", val: "soft" },
        { src: "did:labeler1", val: "hard" },
      ],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "hard");
  });

  it("should respect user preference upgrading nudity from ignore to hide", () => {
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "nudity",
        labelerDid: null,
        visibility: "hide",
      },
    ];

    const labeling = new Labeling(new Preferences(obj), []);
    const author = {
      labels: [{ src: "did:plc:author", val: "nudity" }],
    };
    const result = labeling.getProfileBlurLabel(author);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "nudity");
  });
});

describe("Labeling.hasHideLabel", () => {
  const labelerDefs = [
    {
      creator: { did: "did:labeler1", handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          { identifier: "spam", blurs: "content", defaultSetting: "warn" },
          { identifier: "verified", blurs: "none", defaultSetting: "hide" },
        ],
      },
    },
  ];

  it("should return false when there are no labels", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    assert.deepEqual(labeling.hasHideLabel([]), false);
  });

  it("should return false for a label whose visibility is warn", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    assert.deepEqual(
      labeling.hasHideLabel([{ src: "did:labeler1", val: "spam" }]),
      false,
    );
  });

  it("should return true when the user's preference sets a label to hide", () => {
    const labeling = new Labeling(
      new Preferences([
        {
          $type: "app.bsky.actor.defs#contentLabelPref",
          label: "spam",
          labelerDid: "did:labeler1",
          visibility: "hide",
        },
      ]),
      labelerDefs,
    );
    assert.deepEqual(
      labeling.hasHideLabel([{ src: "did:labeler1", val: "spam" }]),
      true,
    );
  });

  it("should return true for hide labels regardless of blur type", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    assert.deepEqual(
      labeling.hasHideLabel([{ src: "did:labeler1", val: "verified" }]),
      true,
    );
  });

  it("should return true for global labels that default to hide", () => {
    const labeling = new Labeling(new Preferences([]), []);
    assert.deepEqual(
      labeling.hasHideLabel([{ src: "did:plc:author", val: "!hide" }]),
      true,
    );
  });

  it("should ignore labels from labelers the user doesn't subscribe to", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    assert.deepEqual(
      labeling.hasHideLabel([{ src: "did:labeler2", val: "spam" }]),
      false,
    );
  });
});

describe("Labeling.getContentLabel - global labels", () => {
  it("should handle !hide global label with forced hide visibility", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!hide" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
    assert.deepEqual(result.labeler, null);
  });

  it("should handle !warn global label with forced warn visibility", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "!warn");
    assert.deepEqual(result.labeler, null);
  });

  it("should resolve the labeler for a global label from a loaded labeler", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:modservice", handle: "mod.test" },
        policies: { labelValueDefinitions: [] },
      },
    ];
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.labeler, labelerDefs[0]);
  });

  it("should not allow user to override !hide visibility", () => {
    // User tries to set !hide to "ignore" - should still be "hide"
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "!hide",
        labelerDid: "did:plc:modservice",
        visibility: "ignore",
      },
    ];

    const labeling = new Labeling(new Preferences(obj), []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!hide" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
  });

  it("should not allow user to override !warn visibility", () => {
    // User tries to set !warn to "ignore" - should still be "warn"
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "!warn",
        labelerDid: "did:plc:modservice",
        visibility: "ignore",
      },
    ];

    const labeling = new Labeling(new Preferences(obj), []);
    const post = {
      labels: [{ src: "did:plc:modservice", val: "!warn" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
  });

  it("should prefer !hide over !warn when both present", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      labels: [
        { src: "did:plc:modservice", val: "!warn" },
        { src: "did:plc:modservice", val: "!hide" },
      ],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
  });
});

const adultContentEnabledPref = {
  $type: "app.bsky.actor.defs#adultContentPref",
  enabled: true,
};

describe("Labeling.getMediaLabel - global self-labels", () => {
  it("should handle porn self-label with default hide visibility", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    // Self-labels have src = author's DID, not a labeler's DID
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "porn" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
    assert.deepEqual(result.labeler, null);
  });

  it("should handle sexual self-label with default warn visibility", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "sexual" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "sexual");
  });

  it("should handle nudity self-label with default ignore visibility", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "nudity" }],
    };
    const result = labeling.getMediaLabel(post);

    // nudity defaults to "ignore", so should return null
    assert.deepEqual(result, null);
  });

  it("should handle graphic-media self-label", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "graphic-media" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "graphic-media");
  });

  it("should handle legacy gore label", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "gore" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "gore");
  });

  it("should allow user to change self-label visibility", () => {
    // User sets porn to "warn" instead of default "hide" on the global labeler
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "porn",
        labelerDid: "did:plc:ar7c4by46qjdydhdevvrndac",
        visibility: "warn",
      },
    ];

    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref, ...obj]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "porn" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "warn");
  });

  it("should prefer most restrictive self-label", () => {
    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "sexual" }, // default: warn
        { src: "did:plc:author123", val: "porn" }, // default: hide
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
  });
});

describe("Labeling.getContentLabel - mixed global and custom labels", () => {
  it("should check both global and custom labels", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-warn",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Custom Warning" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [{ src: "did:plc:labeler1", val: "custom-warn" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.labelDefinition.identifier, "custom-warn");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
  });

  it("should return global label when more restrictive than custom", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-warn",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Custom Warning" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [
        { src: "did:plc:labeler1", val: "custom-warn" }, // warn
        { src: "did:plc:modservice", val: "!hide" }, // hide (global)
      ],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "!hide");
    assert.deepEqual(result.labeler, null);
  });

  it("should return custom label when more restrictive than global", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-hide",
              blurs: "content",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Custom Hide" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [
        { src: "did:plc:modservice", val: "!warn" }, // warn (global) - processed first
        { src: "did:plc:labeler1", val: "custom-hide" }, // hide - processed second, should win
      ],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-hide");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
  });

  it("should return first warn when no hide labels exist", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-warn",
              blurs: "content",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Custom Warning" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const post = {
      labels: [
        { src: "did:plc:modservice", val: "!warn" }, // warn (global) - first
        { src: "did:plc:labeler1", val: "custom-warn" }, // warn (custom)
      ],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
    // Should be the first warn encountered
    assert.deepEqual(result.labelDefinition.identifier, "!warn");
  });
});

describe("Labeling.getMediaLabel - mixed global and custom labels", () => {
  it("should return global label when more restrictive than custom", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-media-warn",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Custom Media Warning" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      labelerDefs,
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:labeler1", val: "custom-media-warn" }, // warn
        { src: "did:plc:author123", val: "porn" }, // hide (global self-label)
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "porn");
    assert.deepEqual(result.labeler, null);
  });

  it("should return custom label when more restrictive than global", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-media-hide",
              blurs: "media",
              defaultSetting: "hide",
              locales: [{ lang: "en", name: "Custom Media Hide" }],
            },
          ],
        },
      },
    ];

    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref]),
      labelerDefs,
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "sexual" }, // warn (global self-label)
        { src: "did:plc:labeler1", val: "custom-media-hide" }, // hide
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-media-hide");
    assert.deepEqual(result.labeler.creator.did, "did:plc:labeler1");
  });

  it("should handle mix of global self-labels and custom labels with user prefs", () => {
    const labelerDefs = [
      {
        creator: { did: "did:plc:labeler1", handle: "labeler.test" },
        policies: {
          labelValueDefinitions: [
            {
              identifier: "custom-media",
              blurs: "media",
              defaultSetting: "warn",
              locales: [{ lang: "en", name: "Custom Media" }],
            },
          ],
        },
      },
    ];
    // User sets porn to warn and custom-media to hide
    const obj = [
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "porn",
        labelerDid: "did:plc:ar7c4by46qjdydhdevvrndac",
        visibility: "warn",
      },
      {
        $type: "app.bsky.actor.defs#contentLabelPref",
        label: "custom-media",
        labelerDid: "did:plc:labeler1",
        visibility: "hide",
      },
    ];

    const labeling = new Labeling(
      new Preferences([adultContentEnabledPref, ...obj]),
      labelerDefs,
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "porn" }, // user set to warn
        { src: "did:plc:labeler1", val: "custom-media" }, // user set to hide
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.labelDefinition.identifier, "custom-media");
  });
});

describe("Labeling - adult-only labels", () => {
  const adultContentPref = (enabled) => ({
    $type: "app.bsky.actor.defs#adultContentPref",
    enabled,
  });
  const labelerDefs = [
    {
      creator: { did: "did:labeler1", handle: "labeler.test" },
      policies: {
        labelValueDefinitions: [
          {
            identifier: "adult-custom",
            blurs: "content",
            defaultSetting: "warn",
            adultOnly: true,
            locales: [{ lang: "en", name: "Adult Custom" }],
          },
        ],
      },
    },
  ];
  const ignorePref = {
    $type: "app.bsky.actor.defs#contentLabelPref",
    label: "adult-custom",
    labelerDid: "did:labeler1",
    visibility: "ignore",
  };
  const labeledPost = {
    author: { did: "did:plc:author123" },
    labels: [{ src: "did:labeler1", val: "adult-custom" }],
  };

  it("should force adult-only labels to hide when adult content is disabled", () => {
    const labeling = new Labeling(
      new Preferences([adultContentPref(false), ignorePref]),
      labelerDefs,
    );
    const result = labeling.getContentLabel(labeledPost);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.noOverride, true);
  });

  it("should respect the label preference when adult content is enabled", () => {
    const labeling = new Labeling(
      new Preferences([adultContentPref(true), ignorePref]),
      labelerDefs,
    );

    assert.deepEqual(labeling.getContentLabel(labeledPost), null);
  });

  it("should allow overriding adult-only labels when adult content is enabled", () => {
    const labeling = new Labeling(
      new Preferences([adultContentPref(true)]),
      labelerDefs,
    );
    const result = labeling.getContentLabel(labeledPost);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.noOverride, false);
  });

  it("should force adult-only global self-labels to hide when adult content is disabled", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "graphic-media" }],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.noOverride, true);
  });

  it("should not affect labels that are not adult-only", () => {
    const labeling = new Labeling(new Preferences([]), []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [{ src: "did:plc:author123", val: "!warn" }],
    };
    const result = labeling.getContentLabel(post);

    assert.deepEqual(result.visibility, "warn");
    assert.deepEqual(result.noOverride, false);
  });

  it("should prefer a non-overridable label over an earlier user-set hide", () => {
    const hideNudityPref = {
      $type: "app.bsky.actor.defs#contentLabelPref",
      label: "nudity",
      visibility: "hide",
    };
    const labeling = new Labeling(new Preferences([hideNudityPref]), []);
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "nudity" },
        { src: "did:plc:author123", val: "porn" },
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.label.val, "porn");
    assert.deepEqual(result.noOverride, true);
  });

  it("should prefer a non-overridable profile blur label over an earlier user-set hide", () => {
    const hideNudityPref = {
      $type: "app.bsky.actor.defs#contentLabelPref",
      label: "nudity",
      visibility: "hide",
    };
    const labeling = new Labeling(new Preferences([hideNudityPref]), []);
    const result = labeling.getProfileBlurLabel({
      did: "did:plc:author123",
      labels: [
        { src: "did:plc:author123", val: "nudity" },
        { src: "did:plc:author123", val: "porn" },
      ],
    });

    assert.deepEqual(result.label.val, "porn");
    assert.deepEqual(result.noOverride, true);
  });

  it("should prefer a hide over an earlier warn", () => {
    const hideNudityPref = {
      $type: "app.bsky.actor.defs#contentLabelPref",
      label: "nudity",
      visibility: "hide",
    };
    const labeling = new Labeling(
      new Preferences([adultContentPref(true), hideNudityPref]),
      [],
    );
    const post = {
      author: { did: "did:plc:author123" },
      labels: [
        { src: "did:plc:author123", val: "sexual" },
        { src: "did:plc:author123", val: "nudity" },
      ],
    };
    const result = labeling.getMediaLabel(post);

    assert.deepEqual(result.label.val, "nudity");
    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.noOverride, false);
  });

  it("should mark adult-only profile blur labels as non-overridable", () => {
    const labeling = new Labeling(new Preferences([]), labelerDefs);
    const result = labeling.getProfileBlurLabel({
      labels: [{ src: "did:labeler1", val: "adult-custom" }],
    });

    assert.deepEqual(result.visibility, "hide");
    assert.deepEqual(result.noOverride, true);
  });
});
