import { getPostLangs, readFileAsDataUrl, wait } from "/js/utils.js";
import { computeRecordCid, generateTid } from "/js/atproto.js";
import { ImageCompressor } from "/js/imageCompressor.js";
import {
  getUnresolvedFacetsFromText,
  resolveFacets,
} from "/js/facetHelpers.js";

// Matches social-app - strip leading + trailing whitespace and collapse runs of 3+ newlines to 2
const excessNewlinesRegex = /[\r\n]([­⁠‍‌​\s]*[\r\n]){2,}/g;

function trimPostText(text) {
  if (!text) return "";
  return text
    .replace(/^(\s*\n)+/, "")
    .trimEnd()
    .replace(excessNewlinesRegex, "\n\n");
}

export class PostCreator {
  constructor(api, identityResolver, imageCompressor = new ImageCompressor()) {
    this.api = api;
    this.identityResolver = identityResolver;
    this.imageCompressor = imageCompressor;
  }

  async createThread({
    posts,
    replyTo,
    replyRoot,
    threadgateAllow = null,
    postgateEmbeddingRules = null,
    signal = null,
  }) {
    if (!posts || posts.length === 0) {
      throw new Error("createThread requires at least one post");
    }
    let reply = null;
    if (replyTo) {
      if (!replyRoot) {
        throw new Error("replyRoot is required when replyTo is provided");
      }
      reply = {
        root: { uri: replyRoot.uri, cid: replyRoot.cid },
        parent: { uri: replyTo.uri, cid: replyTo.cid },
      };
    }

    const did = this.api.session.did;
    const langs = getPostLangs();
    const writes = [];
    const uris = [];
    // Sort order for posts sharing a createdAt is undefined, so each post
    // gets a +1ms bump like social-app does.
    const baseTime = Date.now();

    for (let i = 0; i < posts.length; i++) {
      signal?.throwIfAborted();
      const { text, facets, embed } = await this._buildPostContent(posts[i], {
        signal,
      });
      const rkey = generateTid();
      const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
      const createdAt = new Date(baseTime + i).toISOString();
      const record = {
        $type: "app.bsky.feed.post",
        text,
        facets,
        createdAt,
        langs,
      };
      if (embed) {
        record.embed = embed;
      }
      if (reply) {
        record.reply = reply;
      }
      if (posts[i].labels) {
        record.labels = posts[i].labels;
      }

      writes.push({
        $type: "com.atproto.repo.applyWrites#create",
        collection: "app.bsky.feed.post",
        rkey,
        value: record,
      });
      uris.push(uri);

      if (i === 0 && threadgateAllow) {
        writes.push({
          $type: "com.atproto.repo.applyWrites#create",
          collection: "app.bsky.feed.threadgate",
          rkey,
          value: {
            $type: "app.bsky.feed.threadgate",
            post: uri,
            allow: threadgateAllow,
            createdAt,
          },
        });
      }
      if (postgateEmbeddingRules?.length > 0) {
        writes.push({
          $type: "com.atproto.repo.applyWrites#create",
          collection: "app.bsky.feed.postgate",
          rkey,
          value: {
            $type: "app.bsky.feed.postgate",
            post: uri,
            embeddingRules: postgateEmbeddingRules,
            createdAt,
          },
        });
      }

      if (i < posts.length - 1) {
        const ref = { uri, cid: await computeRecordCid(record) };
        reply = { root: reply?.root ?? ref, parent: ref };
      }
    }

    // Last chance to cancel: the commit itself is deliberately not abortable
    signal?.throwIfAborted();
    await this.api.applyWrites(writes);

    // Attempt to get the full posts from the app view, null on failure.
    const maxRetries = 5;
    let fullPosts = null;
    for (let tries = 0; tries < maxRetries; tries++) {
      try {
        const fetched = await this.api.getPosts(uris);
        if (fetched.length === uris.length) {
          fullPosts = fetched;
          break;
        }
      } catch (e) {}
      if (tries < maxRetries - 1) {
        await wait(1000);
      }
    }

    return { uris, posts: fullPosts };
  }

  async _buildPostContent(
    { postText, external, quotedRecord, images, video },
    { signal = null } = {},
  ) {
    const trimmedText = trimPostText(postText);
    const unresolvedFacets = getUnresolvedFacetsFromText(trimmedText);
    const facets = await resolveFacets(unresolvedFacets, this.identityResolver);
    signal?.throwIfAborted();
    const externalEmbed = await this._prepareExternalEmbed(external, {
      signal,
    });
    const imagesEmbed = await this._prepareImagesEmbed(images, { signal });
    const videoEmbed = this._prepareVideoEmbed(video);

    let quotedRecordEmbed = null;
    if (quotedRecord) {
      quotedRecordEmbed = {
        $type: "app.bsky.embed.record",
        record: {
          uri: quotedRecord.uri,
          cid: quotedRecord.cid,
        },
      };
    }

    // Prioritize video > images > external link (these are mutually exclusive)
    const mediaEmbed = videoEmbed || imagesEmbed || externalEmbed;

    let embed = null;
    if (mediaEmbed && quotedRecordEmbed) {
      embed = {
        $type: "app.bsky.embed.recordWithMedia",
        media: mediaEmbed,
        record: quotedRecordEmbed,
      };
    } else if (mediaEmbed) {
      embed = mediaEmbed;
    } else if (quotedRecordEmbed) {
      embed = quotedRecordEmbed;
    }

    return { text: trimmedText, facets, embed };
  }

  async _prepareImagesEmbed(images, { signal = null } = {}) {
    if (!images || images.length === 0) {
      return null;
    }

    const uploadedImages = [];
    for (const img of images) {
      signal?.throwIfAborted();
      const compressedImage = await this.imageCompressor.compressImage(
        img.dataUrl,
      );
      const blob = await this.api.uploadBlob(compressedImage.blob, { signal });

      uploadedImages.push({
        $type: "app.bsky.embed.images#image",
        alt: img.alt || "",
        image: {
          $type: "blob",
          ref: {
            $link: blob.ref.$link,
          },
          mimeType: blob.mimeType,
          size: blob.size,
        },
        aspectRatio: {
          $type: "app.bsky.embed.defs#aspectRatio",
          width: compressedImage.width,
          height: compressedImage.height,
        },
      });
    }

    return {
      $type: "app.bsky.embed.images",
      images: uploadedImages,
    };
  }

  _prepareVideoEmbed(video) {
    if (!video || !video.blob) {
      return null;
    }
    const embed = {
      $type: "app.bsky.embed.video",
      video: {
        $type: "blob",
        ref: { $link: video.blob.ref.$link },
        mimeType: video.blob.mimeType,
        size: video.blob.size,
      },
    };
    if (video.alt) {
      embed.alt = video.alt;
    }
    if (
      video.aspectRatio &&
      video.aspectRatio.width > 0 &&
      video.aspectRatio.height > 0
    ) {
      embed.aspectRatio = {
        $type: "app.bsky.embed.defs#aspectRatio",
        width: video.aspectRatio.width,
        height: video.aspectRatio.height,
      };
    }
    return embed;
  }

  async _prepareExternalEmbed(external, { signal = null } = {}) {
    if (!external) {
      return null;
    }
    const externalImage = external.image;
    const externalEmbed = {
      $type: "app.bsky.embed.external",
      external: {
        title: external.title,
        description: external.description,
        uri: external.url, // note - renaming url to uri
      },
    };
    // If there's an external link, upload the preview image
    if (externalImage) {
      try {
        const imageRes = await fetch(externalImage, { signal });
        const imageBlob = await imageRes.blob();
        const dataUrl = await readFileAsDataUrl(imageBlob);
        const compressedImage =
          await this.imageCompressor.compressImage(dataUrl);
        const blob = await this.api.uploadBlob(compressedImage.blob, {
          signal,
        });
        externalEmbed.external.thumb = {
          $type: "blob",
          mimeType: blob.mimeType,
          ref: {
            $link: blob.ref.$link,
          },
          size: blob.size,
        };
      } catch (error) {
        if (error.name === "AbortError") {
          throw error;
        }
        // Don't fail the post creation if the image can't be uploaded
        console.error("Error uploading external link image: ", error);
      }
    }
    return externalEmbed;
  }
}
