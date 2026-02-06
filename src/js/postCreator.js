import { wait } from "/js/utils.js";

const MAX_IMAGE_HEIGHT = 2000;
const MAX_IMAGE_WIDTH = 2000;
const MAX_IMAGE_SIZE = 1000000; // 1MB

async function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function constrainImageSize({ width, height, maxWidth, maxHeight }) {
  // Constrain to fit maxWidth and maxHeight while maintaining aspect ratio
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function estimateDataUrlSize(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  return Math.round((base64.length * 3) / 4);
}

function drawImageToCanvas({ img, width, height, quality }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mimeType });
}

async function compressImage(dataUrl) {
  const img = await loadImageFromDataUrl(dataUrl);
  const { width, height } = constrainImageSize({
    width: img.width,
    height: img.height,
    maxWidth: MAX_IMAGE_WIDTH,
    maxHeight: MAX_IMAGE_HEIGHT,
  });

  // Same as social-app: Binary search to find the optimal JPEG quality under the size limit
  let minQuality = 0;
  let maxQuality = 100;
  let bestDataUrl = null;

  while (maxQuality - minQuality > 1) {
    const quality = Math.round((minQuality + maxQuality) / 2);
    const result = drawImageToCanvas({
      img,
      width,
      height,
      quality: quality / 100,
    });

    if (estimateDataUrlSize(result) <= MAX_IMAGE_SIZE) {
      bestDataUrl = result;
      minQuality = quality;
    } else {
      maxQuality = quality;
    }
  }

  // If no acceptable quality found, use the lowest quality result
  if (!bestDataUrl) {
    bestDataUrl = drawImageToCanvas({ img, width, height, quality: 0 });
  }

  return {
    blob: dataUrlToBlob(bestDataUrl),
    width,
    height,
  };
}

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
      const compressedImage = await compressImage(img.dataUrl);
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
