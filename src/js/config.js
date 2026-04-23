// shared constants, etc.

export const NOTIFICATIONS_PAGE_SIZE = 40;
export const FEED_PAGE_SIZE = 40;
export const HASHTAG_FEED_PAGE_SIZE = 40;
export const BOOKMARKS_PAGE_SIZE = 40;
export const AUTHOR_FEED_PAGE_SIZE = 40;
export const DISCOVER_FEED_URI =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
export const CHAT_MESSAGES_PAGE_SIZE = 100;

// Appview dids
export const BSKY_APPVIEW_SERVICE_DID = "did:web:api.bsky.app#bsky_appview";
export const BSKY_CHAT_SERVICE_DID = "did:web:api.bsky.chat#bsky_chat";

// Bluesky-operated services
export const PUBLIC_SERVICE_ENDPOINT_URL = "https://public.api.bsky.app";
export const HANDLE_RESOLVER_SERVICE_URL = "https://public.api.bsky.app";
export const TYPEAHEAD_SERVICE_URL = "https://public.api.bsky.app";
export const LINK_CARD_SERVICE_URL = "https://cardyb.bsky.app";
export const OG_CARD_SERVICE_URL = "https://ogcard.cdn.bsky.app";
export const TENOR_GIF_PROXY_URL = "https://t.gifs.bsky.app";
export const PLC_DIRECTORY_URL = "https://plc.directory";

export const BSKY_LABELER_DID = "did:plc:ar7c4by46qjdydhdevvrndac";

export const IN_APP_LINK_DOMAINS = [
  "bsky.app",
  "impro.social",
  "dev.impro.social",
  "localhost",
];

export const AppViewConfig = {
  BLUESKY: {
    id: "bluesky",
    displayName: "Bluesky",
    appViewServiceDid: "did:web:api.bsky.app#bsky_appview",
    chatServiceDid: "did:web:api.bsky.chat#bsky_chat",
  },
  BLACKSKY: {
    id: "blacksky",
    displayName: "Blacksky",
    appViewServiceDid: "did:web:api.blacksky.community#bsky_appview",
    chatServiceDid: "did:web:api.blacksky.community#bsky_chat",
  },
};

export const DEFAULT_APP_VIEW_CONFIGS = [
  AppViewConfig.BLUESKY,
  AppViewConfig.BLACKSKY,
];
