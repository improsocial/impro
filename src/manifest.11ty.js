import {
  APP_NAME,
  APP_FULL_NAME,
  APP_ICON_192_URL,
  APP_ICON_512_URL,
} from "./js/config.js";

export default {
  data() {
    return {
      permalink: "/manifest.json",
    };
  },

  render() {
    const manifest = {
      name: APP_FULL_NAME,
      short_name: APP_NAME,
      start_url: "/",
      display: "standalone",
      background_color: "#1a1a1a",
      theme_color: "#418af7",
      orientation: "portrait-primary",
      icons: [
        {
          src: APP_ICON_512_URL,
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: APP_ICON_192_URL,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      shortcuts: [
        {
          name: "New Post",
          short_name: "New Post",
          description: "Compose new post",
          url: "/intent/compose",
          icons: [
            {
              src: "/img/shortcut-newpost.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
        {
          name: "Search",
          short_name: "Search",
          description: "Search users and posts",
          url: "/search",
          icons: [
            {
              src: "/img/shortcuts/shortcut-search.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
        {
          name: "Chat",
          short_name: "Chat",
          description: "View your messages",
          url: "/messages",
          icons: [
            {
              src: "/img/shortcut-chat.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
        {
          name: "Notifications",
          short_name: "Notifications",
          description: "View your notifications",
          url: "/notifications",
          icons: [
            {
              src: "/img/shortcuts/shortcut-notifications.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
        {
          name: "Profile",
          short_name: "Profile",
          description: "View your profile",
          url: "/profile",
          icons: [
            {
              src: "/img/shortcuts/shortcut-profile.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
      ],
    };

    return JSON.stringify(manifest, null, 2);
  },
};
