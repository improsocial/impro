// shared constants, etc.

export const NOTIFICATIONS_PAGE_SIZE = 40;
export const NOTIFICATION_GROUP_WINDOW_HOURS = 48;
export const NOTIFICATION_ACTIVITY_MAX_POSTS = 25;
export const FEED_PAGE_SIZE = 40;
export const HASHTAG_FEED_PAGE_SIZE = 40;
export const BOOKMARKS_PAGE_SIZE = 40;
export const AUTHOR_FEED_PAGE_SIZE = 40;
export const LOGGED_OUT_FEED_URI =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
export const FOLLOWING_FEED_URI = "following";
export const CHAT_MESSAGES_PAGE_SIZE = 100;

// Branding
export const APP_NAME = "Impro";
export const APP_FULL_NAME = "Impro Bluesky Client";
export const APP_DESCRIPTION = "A Bluesky client with plugins";
export const APP_HOST = "impro.social";
export const APP_DEV_HOST = "dev.impro.social";
export const APP_LOGO_URL = "/img/impro-logo.jpg";
export const APP_ICON_192_URL = "/img/impro-logo-192.png";
export const APP_ICON_512_URL = "/img/impro-logo-512.png";
export const APP_OG_IMAGE_URL = "/img/impro-logo-og.jpg";
export const PUSH_APP_ID = "social.impro";

// Project links
export const SOURCE_CODE_URL = "https://github.com/improsocial/impro";
export const SUPPORT_URL = "https://github.com/sponsors/improsocial";

// Plugins
export const PLUGIN_REGISTRY_URL =
  "https://raw.githubusercontent.com/improsocial/impro-releases/main/community-plugins.json";

// Appview dids
export const BSKY_APPVIEW_SERVICE_DID = "did:web:api.bsky.app#bsky_appview";
export const BSKY_CHAT_SERVICE_DID = "did:web:api.bsky.chat#bsky_chat";

// Bluesky-operated services
export const PUBLIC_SERVICE_ENDPOINT_URL = "https://public.api.bsky.app";
export const HANDLE_RESOLVER_SERVICE_URL = "https://public.api.bsky.app";
export const LINK_CARD_SERVICE_URL = "https://cardyb.bsky.app";
export const OG_CARD_SERVICE_URL = "https://ogcard.cdn.bsky.app";
export const CDN_URL = "https://cdn.bsky.app";
export const CONSTELLATION_URL = "https://constellation.microcosm.blue";
export const SLINGSHOT_URL = "https://slingshot.microcosm.blue";
export const TENOR_GIF_PROXY_URL = "https://t.gifs.bsky.app";
export const KLIPY_GIF_PROXY_HOSTNAME = "k.gifs.bsky.app";
export const GIF_SERVICE_URL = "https://gifs.bsky.app";
export const PLC_DIRECTORY_URL = "https://plc.directory";
export const VIDEO_SERVICE_URL = "https://video.bsky.app";
export const VIDEO_SERVICE_DID = "did:web:video.bsky.app";

export const BSKY_LABELER_DID = "did:plc:ar7c4by46qjdydhdevvrndac";

export const BSKY_FEED_OWNER_DIDS = [
  "did:plc:z72i7hdynmk6r22z27h6tvur",
  "did:plc:vpkhqolt662uhesyj6nxm7ys",
  "did:plc:q6gjnaw2blty4crticxkmujt",
];

export const LIVE_ALLOWED_SERVICES = [
  { domain: "twitch.tv", displayName: "Twitch" },
  { domain: "stream.place", displayName: "Streamplace" },
  { domain: "bluecast.app", displayName: "Bluecast" },
  { domain: "youtube.com", displayName: "YouTube" },
  { domain: "substack.com", displayName: "Substack" },
  { domain: "beehiiv.com", displayName: "Beehiiv" },
];

export const IN_APP_LINK_DOMAINS = ["bsky.app", APP_HOST, APP_DEV_HOST];

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
    chatServiceDid: "did:web:api.bsky.chat#bsky_chat", // uses bsky chat service
  },
  EUROSKY: {
    id: "eurosky",
    displayName: "Eurosky",
    appViewServiceDid: "did:web:api.eurosky.network#bsky_appview",
    chatServiceDid: "did:web:api.bsky.chat#bsky_chat", // uses bsky chat service
  },
};

export const DEFAULT_APP_VIEW_CONFIGS = [
  AppViewConfig.BLUESKY,
  AppViewConfig.BLACKSKY,
  AppViewConfig.EUROSKY,
];

export const NONE_NOTIFICATION_SERVICE_ID = "none";
export const CUSTOM_NOTIFICATION_SERVICE_ID = "custom";

export const NOTIFICATION_SERVICE_PRESETS = [
  {
    id: NONE_NOTIFICATION_SERVICE_ID,
    displayName: "None",
    serviceDid: null,
  },
  {
    id: "courier-7778777",
    displayName: "7778777.online/courier",
    serviceDid: "did:web:courier.7778777.online",
  },
];
