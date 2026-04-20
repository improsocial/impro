const MAX_IMAGE_HEIGHT = 2000;
const MAX_IMAGE_WIDTH = 2000;
const MAX_IMAGE_SIZE = 1000000; // 1MB

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

  if (!bestDataUrl) {
    bestDataUrl = drawImageToCanvas({ img, width, height, quality: 0 });
  }

  return {
    blob: dataUrlToBlob(bestDataUrl),
    width,
    height,
  };
}
