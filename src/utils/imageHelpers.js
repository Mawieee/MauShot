/**
 * imageHelpers.js - Image processing utilities
 *
 * Provides helper functions for image manipulation including
 * cropping, resizing, and format conversion.
 */

const { nativeImage } = require('electron');

/**
 * Convert a buffer or data URL to a NativeImage
 *
 * @param {Buffer|string} imageData - The image data as Buffer or base64 data URL
 * @returns {nativeImage} Electron NativeImage object
 * @throws {Error} If the image data type is invalid
 */
function toNativeImage(imageData) {
  if (Buffer.isBuffer(imageData)) {
    return nativeImage.createFromBuffer(imageData);
  } else if (typeof imageData === 'string') {
    // Handle base64 data URL format
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const buffer = Buffer.from(base64Data, 'base64');
    return nativeImage.createFromBuffer(buffer);
  } else {
    throw new Error(`Invalid image data type: ${typeof imageData}`);
  }
}

/**
 * Convert image data to base64 data URL
 *
 * @param {Buffer|string} imageData - The image data as Buffer or base64 string
 * @param {string} [mimeType='image/png'] - The MIME type for the data URL
 * @returns {string} Base64 data URL (e.g., "data:image/png;base64,...")
 */
function toDataUrl(imageData, mimeType = 'image/png') {
  let buffer;

  if (Buffer.isBuffer(imageData)) {
    buffer = imageData;
  } else if (typeof imageData === 'string') {
    // Already a base64 string, possibly with data URL prefix
    if (imageData.includes(',')) {
      return imageData; // Already a data URL
    }
    buffer = Buffer.from(imageData, 'base64');
  } else {
    throw new Error(`Invalid image data type: ${typeof imageData}`);
  }

  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Create a thumbnail from an image
 *
 * Maintains aspect ratio while scaling to the target width.
 *
 * @param {Buffer|nativeImage} image - The source image
 * @param {number} [width=200] - Target width for the thumbnail
 * @returns {Buffer} The thumbnail image as PNG buffer
 */
function createThumbnail(image, width = 200) {
  const nativeImg = Buffer.isBuffer(image) ? nativeImage.createFromBuffer(image) : image;
  const size = nativeImg.getSize();

  // Calculate height maintaining aspect ratio
  const height = Math.round(width * (size.height / size.width));

  // Resize and return as PNG buffer
  const thumbnail = nativeImg.resize({ width, height });
  return thumbnail.toPNG();
}

/**
 * Crop an image to the specified bounds
 *
 * @param {Buffer|nativeImage} image - The source image
 * @param {Object} bounds - The crop bounds
 * @param {number} bounds.x - X coordinate of crop area
 * @param {number} bounds.y - Y coordinate of crop area
 * @param {number} bounds.width - Width of crop area
 * @param {number} bounds.height - Height of crop area
 * @returns {nativeImage} The cropped image
 */
function cropImage(image, bounds) {
  const nativeImg = Buffer.isBuffer(image) ? nativeImage.createFromBuffer(image) : image;

  return nativeImg.crop({
    x: Math.floor(bounds.x),
    y: Math.floor(bounds.y),
    width: Math.floor(bounds.width),
    height: Math.floor(bounds.height)
  });
}

/**
 * Validate crop bounds are within image dimensions
 *
 * @param {Object} bounds - The crop bounds to validate
 * @param {Object} imageSize - The image size {width, height}
 * @returns {boolean} True if bounds are valid, false otherwise
 */
function validateCropBounds(bounds, imageSize) {
  return (
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.x + bounds.width <= imageSize.width &&
    bounds.y + bounds.height <= imageSize.height
  );
}

/**
 * Convert image to PNG buffer
 *
 * @param {Buffer|nativeImage} image - The source image
 * @returns {Buffer} PNG image buffer
 */
function toPngBuffer(image) {
  const nativeImg = toNativeImage(image);
  return nativeImg.toPNG();
}

module.exports = {
  toNativeImage,
  toDataUrl,
  createThumbnail,
  cropImage,
  validateCropBounds,
  toPngBuffer
};
