import { wait } from "/js/utils.js";

export class PostCreator {
  constructor(api) {
    this.api = api;
  }

  async createPost({
    postText,
    facets,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
  }) {
    const externalEmbed = await this.prepareExternalEmbed(external);
    const imagesEmbed = await this.prepareImagesEmbed(images);
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

    // Prioritize images over external links (can't have both external and images)
    const mediaEmbed = imagesEmbed || externalEmbed;

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
    do {
      try {
        fullPost = await this.api.getPost(res.uri);
      } catch (e) {}
      await wait(200);
    } while (!fullPost && tries < 3);
    if (!fullPost) {
      throw new Error(`Failed to get post: ${res.uri}`);
    }

    return fullPost;
  }

  async prepareImagesEmbed(images) {
    if (!images || images.length === 0) {
      return null;
    }

    const uploadedImages = [];
    for (const img of images) {
      const blob = await this.api.uploadBlob(img.file);

      // Get image dimensions
      const aspectRatio = await this.getImageAspectRatio(img.dataUrl);

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
          width: aspectRatio.width,
          height: aspectRatio.height,
        },
      });
    }

    return {
      $type: "app.bsky.embed.images",
      images: uploadedImages,
    };
  }

  async getImageAspectRatio(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        // Default aspect ratio if image can't be loaded
        resolve({ width: 1, height: 1 });
      };
      img.src = dataUrl;
    });
  }

  async prepareExternalEmbed(external) {
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
