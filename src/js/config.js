// shared constants, etc.

export const NOTIFICATIONS_PAGE_SIZE = 40;
export const FEED_PAGE_SIZE = 40;
export const HASHTAG_FEED_PAGE_SIZE = 40;
export const BOOKMARKS_PAGE_SIZE = 40;
export const AUTHOR_FEED_PAGE_SIZE = 40;
export const DISCOVER_FEED_URI =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
export const CHAT_MESSAGES_PAGE_SIZE = 100;

// https://docs.bsky.app/docs/advanced-guides/moderation
export const GLOBAL_LABELS = [
  {
    identifier: "!hide",
    configurable: false,
    defaultSetting: "hide",
    blurs: "content",
    severity: "alert",
    locales: [
      {
        lang: "en",
        name: "Content Hidden",
        description: "This content has been hidden by the moderators.",
      },
    ],
  },
  {
    identifier: "!warn",
    configurable: false,
    defaultSetting: "warn",
    blurs: "content",
    severity: "alert",
    locales: [
      {
        lang: "en",
        name: "Content Warning",
        description:
          "This content has received a general warning from moderators.",
      },
    ],
  },
  // Self-label values (users can apply to their own content)
  {
    identifier: "porn",
    configurable: true,
    defaultSetting: "hide",
    blurs: "media",
    severity: "none",
    adultOnly: true,
    locales: [
      {
        lang: "en",
        name: "Adult Content",
        description: "Explicit sexual images.",
      },
    ],
  },
  {
    identifier: "sexual",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    adultOnly: true,
    locales: [
      {
        lang: "en",
        name: "Sexually Suggestive",
        description: "Does not include nudity.",
      },
    ],
  },
  {
    identifier: "nudity",
    configurable: true,
    defaultSetting: "ignore",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Non-sexual Nudity",
        description: "E.g. artistic nudes.",
      },
    ],
  },
  {
    identifier: "graphic-media",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Graphic Media",
        description: "Explicit or potentially disturbing media.",
      },
    ],
  },
  // Legacy label (maps to graphic-media)
  {
    identifier: "gore",
    configurable: true,
    defaultSetting: "warn",
    blurs: "media",
    severity: "none",
    locales: [
      {
        lang: "en",
        name: "Graphic Media",
        description: "Explicit or potentially disturbing media.",
      },
    ],
  },
];
