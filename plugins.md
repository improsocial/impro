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

To publish a plugin version, tag a commit with the version number (e.g. "0.1.0", no v) and push it to a public GitHub repository. To include your plugin in the Community Plugins listing, make a pull request to https://github.com/improsocial/impro-releases with the plugin info.

## API surface

Plugins are currently in **beta** as the API surface is being expanded. However, here are some basic guidelines about what plugins can do:

### Plugins CAN:

- Inject custom CSS
- Add context menu and sidebar items
- Open modals and toasts with custom content
- Add a settings panel to manage their settings
- Store settings on a user account
- Override component rendering with custom HTML (e.g. posts, profiles, buttons etc)
- Add a full page with custom HTML content
- Add custom feed filters
- Make whitelisted network requests (requires permissions)

### Plugins CANNOT:

- Make arbitrary network requests
- Read or modify page HTML directly

If there's a use case you'd like Impro to support that it doesn't currently, please open an issue in this repository to discuss!
