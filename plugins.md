# Impro Plugins

Impro includes an Obsidian-style plugin system to enable extra functionality. You can find an example plugin here: https://github.com/improsocial/impro-sample-plugin.

## Local development

To develop a plugin locally:

1. Clone and run Impro locally
2. Fork the sample plugin (linked above) and clone it locally
3. Symlink your plugin directory into the local plugins directory:

```
ln -s /path/to/my_plugin_dir /path/to/impro/plugins-local/my_plugin_dir
```

Your plugin should now appear in the "Community Plugins" page: `http://localhost:8080/settings/plugins/community`

4. Watch for changes with `npm start`

## Publishing a plugin

To publish a plugin version, tag a commit with the version number (e.g. "0.1.0", no v) and push it to a public GitHub or Tangled repository. To include your plugin in the Community Plugins listing, make a pull request to https://github.com/improsocial/impro-releases with the plugin info.

## API surface

Plugins are currently in **beta** as the API surface is being expanded. However, here are some basic guidelines about what plugins can do:

### Plugins CAN:

- Inject custom CSS
- Add context menu and sidebar items
- Open modals and toasts with custom content
- Add a settings panel to manage their settings
- Store settings on a user account
- Override component rendering with custom HTML (e.g. posts, profiles, buttons etc) [in-progress]
- Add a full page with custom HTML content [in-progress]
- Add custom feed filters
- Transform rich text in posts
- Make whitelisted network requests (requires permissions)
- Read appview data with the current user as the viewer (profiles, posts, etc.)
- Mute, block, or send feed feedback ("show more/less like this") on the user's behalf (requires permissions)
- Create, update, and delete its own records in the signed-in user's own repo
  (`permissions.records: ["write"]`, granted by the user at install/update time — see
  `pluginPermissions.js`'s `isRecordWriteAllowed`). All records-write plugins share a single
  fixed collection (`social.impro.plugins.cloaca` — see `SHARED_PLUGIN_RECORDS_COLLECTION`);
  a plugin doesn't choose its own collection name, since AT Protocol OAuth scopes name an
  exact collection and can't use wildcards, so per-plugin collections would mean a new core
  change _and_ forced re-authentication for every plugin. Isolation between plugins within
  that shared collection is enforced per-record: the host stamps every record it writes with
  the calling plugin's id and refuses to overwrite or delete a record stamped with a
  different plugin's id (see `pluginService.js`'s `putRecord`/`deleteRecord`). The host also
  always overwrites `record.$type` to the shared collection's own NSID before writing — AT
  Protocol requires `$type` to equal the record's containing collection, so a plugin-supplied
  `$type` would otherwise make every write 400 on a real PDS. The write is
  always pinned to the signed-in user's own DID; a plugin can never write to anyone else's
  repo.
- Store plugin settings on a user's account (synced across devices, via `loadData`/`saveData`)
  or purely on the current device (never synced, via `loadLocalData`/`saveLocalData` —
  intended for secrets or device-specific values a plugin shouldn't silently propagate,
  e.g. a locally-held key)
- Render custom inline content next to a user's name wherever moderation label badges
  would otherwise show — profile header, post byline (feed/thread/quoted), and the DM info
  panel — via `registerSlot("author-badges", callback)`, invoked once per rendered user with
  `context.did` set to that user's DID

### Plugins CANNOT:

- Make arbitrary network requests
- Read or modify page HTML directly

If there's a use case you'd like Impro to support that it doesn't currently, please open an issue in this repository to discuss!
