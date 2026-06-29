import { getPostLangs, readFileAsDataUrl, wait } from "/js/utils.js";
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

  async createPost({
    postText,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
    video,
  }) {
    const trimmedText = trimPostText(postText);
    const unresolvedFacets = getUnresolvedFacetsFromText(trimmedText);
    const facets = await resolveFacets(unresolvedFacets, this.identityResolver);
    const externalEmbed = await this._prepareExternalEmbed(external);
    const imagesEmbed = await this._prepareImagesEmbed(images);
    const videoEmbed = this._prepareVideoEmbed(video);
    let reply = null;
    // Add reply reference if provided
    if (replyTo) {
      if (!replyRoot) {
        throw new Error("replyRoot is required when replyTo is provided");
      }
      reply = {
        root: {
          uri: replyRoot.uri,
          cid: replyRoot.cid,
        },
        parent: { uri: replyTo.uri, cid: replyTo.cid },
      };
    }

    // Build embed(s)
    let embed = null;

    let quotedPostEmbed = null;
    if (quotedPost) {
      quotedPostEmbed = {
        $type: "app.bsky.embed.record",
        record: {
          uri: quotedPost.uri,
          cid: quotedPost.cid,
        },
      };
    }

    // Prioritize video > images > external link (these are mutually exclusive)
    const mediaEmbed = videoEmbed || imagesEmbed || externalEmbed;

    if (mediaEmbed && quotedPostEmbed) {
      embed = {
        $type: "app.bsky.embed.recordWithMedia",
        media: mediaEmbed,
        record: quotedPostEmbed,
      };
    } else if (mediaEmbed) {
      embed = mediaEmbed;
    } else if (quotedPostEmbed) {
      embed = quotedPostEmbed;
    }

    const res = await this.api.createPost({
      text: trimmedText,
      facets,
      embed,
      reply,
      langs: getPostLangs(),
    });

    // Attempt to get full post from the app view, return null on failure
    const maxRetries = 5;
    let fullPost = null;
    for (let tries = 0; tries < maxRetries; tries++) {
      try {
        fullPost = await this.api.getPost(res.uri);
        if (fullPost) break;
      } catch (e) {}
      if (tries < maxRetries - 1) {
        await wait(1000);
      }
    }

    return { uri: res.uri, cid: res.cid, post: fullPost };
  }

  async _prepareImagesEmbed(images) {
    if (!images || images.length === 0) {
      return null;
    }

    const uploadedImages = [];
    for (const img of images) {
      const compressedImage = await this.imageCompressor.compressImage(
        img.dataUrl,
      );
      const blob = await this.api.uploadBlob(compressedImage.blob);

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

  async _prepareExternalEmbed(external) {
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
        const imageRes = await fetch(externalImage);
        const imageBlob = await imageRes.blob();
        const dataUrl = await readFileAsDataUrl(imageBlob);
        const compressedImage =
          await this.imageCompressor.compressImage(dataUrl);
        const blob = await this.api.uploadBlob(compressedImage.blob);
        externalEmbed.external.thumb = {
          $type: "blob",
          mimeType: blob.mimeType,
          ref: {
            $link: blob.ref.$link,
          },
          size: blob.size,
        };
      } catch (error) {
        // Don't fail the post creation if the image can't be uploaded
        console.error("Error uploading external link image: ", error);
      }
    }
    return externalEmbed;
  }
}
