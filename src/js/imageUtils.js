const MAX_IMAGE_DIMENSION = 4000;
const MAX_IMAGE_SIZE = 2000000; // 2MB

export async function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function constrainImageSize({ width, height, maxWidth, maxHeight }) {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

export function estimateDataUrlSize(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  return Math.round((base64.length * 3) / 4);
}

export function drawImageToCanvas({ img, width, height, quality }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mimeType });
}

export async function compressImage(dataUrl) {
  const img = await loadImageFromDataUrl(dataUrl);

  // Same as social-app: binary search on JPEG quality, and if that bottoms out
  // without fitting under the size limit, shrink dimensions and retry.
  let attempts = 0;
  let maxDimension = MAX_IMAGE_DIMENSION;
  let minQuality = 0;
  let maxQuality = 101; // exclusive
  let bestDataUrl = null;
  let bestWidth = 0;
  let bestHeight = 0;

  while (maxQuality - minQuality > 1) {
    if (attempts >= 4) break;

    const quality = Math.round((minQuality + maxQuality) / 2);

    if (quality <= 13) {
      minQuality = 0;
      maxQuality = 101;
      attempts++;
      maxDimension = Math.floor(maxDimension * 0.8);
      continue;
    }

    const { width, height } = constrainImageSize({
      width: img.width,
      height: img.height,
      maxWidth: maxDimension,
      maxHeight: maxDimension,
    });

    const result = drawImageToCanvas({
      img,
      width,
      height,
      quality: quality / 100,
    });

    if (estimateDataUrlSize(result) <= MAX_IMAGE_SIZE) {
      bestDataUrl = result;
      bestWidth = width;
      bestHeight = height;
      minQuality = quality;
    } else {
      maxQuality = quality;
    }
  }

  if (!bestDataUrl) {
    throw new Error("Unable to compress image");
  }

  return {
    blob: dataUrlToBlob(bestDataUrl),
    width: bestWidth,
    height: bestHeight,
  };
}
