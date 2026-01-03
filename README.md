# Impro

Impro is a Bluesky client written in HTML, CSS, and JavaScript.
You can try it out here: https://impro.social

## Differences from main client

Impro is designed to have feature parity with the core functionality of the Bluesky web app. (For TBD features, see [planned features](#planned-features)). However, there are some differences in behavior:

### Less restrictive blocking

Unlike the main client's "nuclear block", blocked quotes are not hidden unless the post author is blocking the current user. Additionally, blocked replies are shown unless the author is blocking the current user.

### Themeing

Impro supports changing the "highlight color" of UI elements via the Settings menu.

### Coming soon: shareable themes and plugins!

## Issues and feature requests

If you notice a bug or feature missing, please open [an issue](https://github.com/improsocial/impro/issues) for it or thumbs-up an existing issue.

## Backend

Impro uses the [Bluesky API](https://docs.bsky.app/docs/category/http-reference) for authentication and data fetching. Additionally, it uses [Constellation](https://constellation.microcosm.blue/) to populate blocked replies.

## Dependencies

Impro uses the following external libraries:

- [lit-html](https://www.npmjs.com/package/lit-html) for declarative rendering
- [Capacitor](https://capacitorjs.com/) for native builds
- [HLS.js](https://github.com/video-dev/hls.js/) for streaming video
- [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) for emoji picker UI

The icons are from the [Majesticons](https://github.com/halfmage/majesticons) free icon set (MIT license).

## Development

Impro is a single-page app built with [Eleventy](https://www.11ty.dev/). To run the development server, run:

```bash
npm run start
```

External libraries are included as standalone files in `lib`. In cases where bundling is needed, the libraries are bundled with [esbuild](https://esbuild.github.io/). Changes to these bundles should be rare, but can be triggered manually with the following commands:

```bash
npm run bundle:capacitor
npm run bundle:lit-html
```

## AI Disclosure

The core of Impro is human-designed and human-written, but some views and components were generated using Claude Code. The project owner has reviewed the generated code and takes full responsibility for its accuracy and completeness. In cases where an entire function was written by AI, it is clearly marked with a comment.

## Planned features

The following features are marked as high priority for development:

- Muted word management
- Profile editing
- Tenor GIF picker
- Video upload
- List and starter pack management
- Basic localization

Further features will be added on an as-requested basis.
