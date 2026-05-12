import { wait } from "/js/utils.js";
import { ImageCompressor } from "/js/imageCompressor.js";

export class PostCreator {
  constructor(api, imageCompressor = new ImageCompressor()) {
    this.api = api;
    this.imageCompressor = imageCompressor;
  }

  async createPost({
    postText,
    facets,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
    video,
  }) {
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
      text: postText,
      facets,
      embed,
      reply,
    });

    // Get full post from the app view
    let fullPost = null;
    let tries = 0;
    while (!fullPost && tries < 3) {
      try {
        fullPost = await this.api.getPost(res.uri);
      } catch (e) {}
      if (!fullPost) await wait(200);
      tries++;
    }
    if (!fullPost) {
      throw new Error(`Failed to get post: ${res.uri}`);
    }

    return fullPost;
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
    if (video.aspectRatio) {
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
        const blob = await this.api.uploadBlob(imageBlob);
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
