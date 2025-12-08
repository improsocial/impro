# Impro

Impro is a Bluesky client written in HTML, CSS, and JavaScript. It is dependency-light by design and intended to serve as an example for implementing common Bluesky client features in vanilla JS.

You can try it out here: https://impro.social

## Dependencies

Impro uses the following libraries:

- [lit-html](https://www.npmjs.com/package/lit-html) for declarative rendering
- [Capacitor](https://capacitorjs.com/) for native builds
- [HLS.js](https://github.com/video-dev/hls.js/) for streaming video
- [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) for emoji picker UI

The icons are from the [Majesticons](https://github.com/halfmage/majesticons) free icon set.

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
