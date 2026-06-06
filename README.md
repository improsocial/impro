# Impro

Impro is a Bluesky web client written in HTML, CSS, and JavaScript.

You can try it out here: https://impro.social

## What makes Impro great?

Impro is:

- **Web-first**: Impro was built from scratch for the web, with no heavy cross-platform frameworks or libraries.
- **Familiar by default:** Out of the box, Impro offers the same feature set as the main Bluesky client.
- **Extensible by design:** If you want additional functionality, you can use [Community Plugins](/plugins.md) to customize your experience.
- **Better about blocking**: Unlike the main client's "nuclear block", thread context is preserved for non-blocked users.

## Issues and feature requests

If you notice a bug or feature missing, please open [an issue](https://github.com/improsocial/impro/issues) for it or thumbs-up an existing issue!

## Backend

Impro uses the [Bluesky API](https://docs.bsky.app/docs/category/http-reference) for authentication and data fetching. Additionally, it uses [Constellation](https://constellation.microcosm.blue/) to populate blocked replies.

## Dependencies

Impro uses the following libraries:

- [lit-html](https://www.npmjs.com/package/lit-html) for declarative rendering
- [HLS.js](https://github.com/video-dev/hls.js/) for streaming video
- [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) for emoji picker UI
- [marked](https://github.com/markedjs/marked) and [DOMPurify](https://github.com/cure53/dompurify) for rendering plugin READMEs

The icons are from the [Majesticons](https://github.com/halfmage/majesticons) free icon set (MIT license).

## Development

Impro is a single-page app built with [Eleventy](https://www.11ty.dev/). To run the development server, run:

```bash
npm run start
```

If you'd like to test changes to the Oauth configuration, you can start the server with a [Cloudflare Tunnel](https://github.com/cloudflare/cloudflared) (requires `cloudflared`):

```bash
npm run start:tunnel
```

External libraries are included as standalone files in `lib`. In cases where bundling is needed, the libraries are bundled with [esbuild](https://esbuild.github.io/). Changes to these bundles should be rare, but can be triggered manually with the following commands:

```bash
npm run bundle:capacitor
npm run bundle:lit-html
```

## AI Disclosure

The core of Impro is human-designed and human-written, but some views and components were generated using Claude Code. The project owner has reviewed the generated code and takes full responsibility for its accuracy and completeness.
