import { Component } from "/js/components/component.js";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

// Claude wrote this
class ImageCropper extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this._scale = 1;
    this._offsetX = 0;
    this._offsetY = 0;
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartOffsetX = 0;
    this._dragStartOffsetY = 0;
    this._img = null;

    this.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.className = "image-cropper-canvas";
    this.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d") || null;

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "image-cropper-slider-container";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "image-cropper-slider";
    slider.min = "0";
    slider.max = "100";
    slider.value = "0";
    slider.step = "1";
    sliderContainer.appendChild(slider);
    this.appendChild(sliderContainer);
    this._slider = slider;

    this._bindEvents();
    this.initialized = true;

    if (this.getAttribute("src")) {
      this.loadImage(this.getAttribute("src"));
    }
  }

  static get observedAttributes() {
    return ["src", "aspect-ratio", "circular"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized) return;
    if (name === "src" && newValue !== oldValue) {
      this.loadImage(newValue);
    } else if (name === "aspect-ratio" || name === "circular") {
      this._draw();
    }
  }

  get aspectRatio() {
    return parseFloat(this.getAttribute("aspect-ratio")) || 1;
  }

  get circular() {
    return this.hasAttribute("circular");
  }

  async loadImage(src) {
    const img = document.createElement("img");
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });
    this._img = img;
    this._scale = 1;
    this._offsetX = 0;
    this._offsetY = 0;
    this._draw();
    this._fitInitialScale();
    this._draw();
  }

  _fitInitialScale() {
    if (!this._img) return;
    this._scale = this._getMinScale();
    this._offsetX = 0;
    this._offsetY = 0;
    this._syncSlider();
  }

  _getCropRect() {
    const rect = this._canvas.getBoundingClientRect();
    const padding = 20;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const aspectRatio = this.aspectRatio;

    let cropWidth, cropHeight;
    if (maxWidth / maxHeight > aspectRatio) {
      cropHeight = maxHeight;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropWidth = maxWidth;
      cropHeight = cropWidth / aspectRatio;
    }

    return {
      x: (rect.width - cropWidth) / 2,
      y: (rect.height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    };
  }

  _clampOffset() {
    if (!this._img) return;
    const rect = this._canvas.getBoundingClientRect();
    const padding = 20;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const aspectRatio = this.aspectRatio;

    let cropWidth, cropHeight;
    if (maxWidth / maxHeight > aspectRatio) {
      cropHeight = maxHeight;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropWidth = maxWidth;
      cropHeight = cropWidth / aspectRatio;
    }

    const imgWidth = this._img.width * this._scale;
    const imgHeight = this._img.height * this._scale;

    const maxOffsetX = Math.max(0, (imgWidth - cropWidth) / 2);
    const maxOffsetY = Math.max(0, (imgHeight - cropHeight) / 2);
    this._offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, this._offsetX));
    this._offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, this._offsetY));
  }

  _draw() {
    if (!this._ctx) return;
    const canvas = this._canvas;
    const ctx = this._ctx;
    const rect = this._canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const displayWidth = rect.width;
    const displayHeight = rect.height;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    if (!this._img) return;

    const cropRect = this._getCropRect();
    const cropX = cropRect.x;
    const cropY = cropRect.y;
    const cropWidth = cropRect.width;
    const cropHeight = cropRect.height;

    const imgWidth = this._img.width * this._scale;
    const imgHeight = this._img.height * this._scale;
    const imgX = displayWidth / 2 - imgWidth / 2 + this._offsetX;
    const imgY = displayHeight / 2 - imgHeight / 2 + this._offsetY;

    ctx.drawImage(this._img, imgX, imgY, imgWidth, imgHeight);

    // Darken area outside the crop zone
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";

    if (this.circular) {
      // Draw darkened overlay with circular cutout
      ctx.beginPath();
      ctx.rect(0, 0, displayWidth, displayHeight);
      const radius = cropWidth / 2;
      const cx = cropX + cropWidth / 2;
      const cy = cropY + cropHeight / 2;
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fill("evenodd");

      // Draw circle border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Draw darkened overlay with rectangular cutout
      ctx.beginPath();
      ctx.rect(0, 0, displayWidth, displayHeight);
      ctx.rect(cropX, cropY, cropWidth, cropHeight);
      ctx.fill("evenodd");

      // Draw rect border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
    }
  }

  _bindEvents() {
    const canvas = this._canvas;

    canvas.addEventListener("pointerdown", (event) => {
      this._dragging = true;
      this._dragStartX = event.clientX;
      this._dragStartY = event.clientY;
      this._dragStartOffsetX = this._offsetX;
      this._dragStartOffsetY = this._offsetY;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this._dragging) return;
      this._offsetX =
        this._dragStartOffsetX + (event.clientX - this._dragStartX);
      this._offsetY =
        this._dragStartOffsetY + (event.clientY - this._dragStartY);
      this._clampOffset();
      this._draw();
    });

    canvas.addEventListener("pointerup", () => {
      this._dragging = false;
    });

    canvas.addEventListener("pointercancel", () => {
      this._dragging = false;
    });

    this._slider.addEventListener("input", () => {
      const sliderValue = parseFloat(this._slider.value) / 100;
      const minScale = this._getMinScale();
      this._scale = minScale + sliderValue * (MAX_SCALE - minScale);
      this._clampOffset();
      this._draw();
    });
  }

  _getMinScale() {
    if (!this._img) return MIN_SCALE;
    const rect = this._canvas.getBoundingClientRect();
    const padding = 20;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const aspectRatio = this.aspectRatio;

    let cropWidth, cropHeight;
    if (maxWidth / maxHeight > aspectRatio) {
      cropHeight = maxHeight;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropWidth = maxWidth;
      cropHeight = cropWidth / aspectRatio;
    }

    const minScaleX = cropWidth / this._img.width;
    const minScaleY = cropHeight / this._img.height;
    return Math.max(minScaleX, minScaleY);
  }

  _fitMinScale() {
    const minScale = this._getMinScale();
    if (this._scale < minScale) {
      this._scale = minScale;
    }
  }

  _syncSlider() {
    const minScale = this._getMinScale();
    const range = MAX_SCALE - minScale;
    const value = range > 0 ? ((this._scale - minScale) / range) * 100 : 0;
    this._slider.value = String(Math.round(value));
  }

  cropImage() {
    if (!this._img) return null;
    const rect = this._canvas.getBoundingClientRect();
    const padding = 20;
    const maxWidth = rect.width - padding * 2;
    const maxHeight = rect.height - padding * 2;
    const aspectRatio = this.aspectRatio;

    let cropWidth, cropHeight;
    if (maxWidth / maxHeight > aspectRatio) {
      cropHeight = maxHeight;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropWidth = maxWidth;
      cropHeight = cropWidth / aspectRatio;
    }

    const cropX = (rect.width - cropWidth) / 2;
    const cropY = (rect.height - cropHeight) / 2;

    const imgWidth = this._img.width * this._scale;
    const imgHeight = this._img.height * this._scale;
    const imgX = rect.width / 2 - imgWidth / 2 + this._offsetX;
    const imgY = rect.height / 2 - imgHeight / 2 + this._offsetY;

    // Calculate source region in image coordinates
    const srcX = (cropX - imgX) / this._scale;
    const srcY = (cropY - imgY) / this._scale;
    const srcWidth = cropWidth / this._scale;
    const srcHeight = cropHeight / this._scale;

    // Output at a reasonable resolution, scaling proportionally
    const maxOutputDimension = 2000;
    const scaleFactor = Math.min(
      1,
      maxOutputDimension / srcWidth,
      maxOutputDimension / srcHeight,
    );
    const outputWidth = Math.round(srcWidth * scaleFactor);
    const outputHeight = Math.round(srcHeight * scaleFactor);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const outputCtx = outputCanvas.getContext("2d");
    outputCtx.fillStyle = "#ffffff";
    outputCtx.fillRect(0, 0, outputWidth, outputHeight);
    outputCtx.drawImage(
      this._img,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    return outputCanvas.toDataURL("image/jpeg", 0.9);
  }
}

ImageCropper.register();
