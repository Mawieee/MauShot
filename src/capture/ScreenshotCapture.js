/**
 * ScreenshotCapture.js - Screen capture functionality
 *
 * Handles capturing screenshots from the screen using Electron's desktopCapturer.
 * Supports both full-screen and area-specific capture.
 */

const { desktopCapturer, screen, nativeImage } = require('electron');
const { createLogger } = require('../utils/logger');
const { validateCropBounds, cropImage, toNativeImage } = require('../utils/imageHelpers');
const DisplayMappingStore = require('../storage/DisplayMappingStore');
const Jimp = require('jimp');

class ScreenshotCapture {
  /**
   * Create a new ScreenshotCapture instance
   */
  constructor() {
    this.logger = createLogger('ScreenshotCapture');
    this.mappingStore = new DisplayMappingStore();
  }

  /**
   * Capture the entire display where the mouse cursor is located
   * This allows capturing any monitor (including external monitors) based on cursor position
   *
   * @returns {Promise<{image: Buffer, bounds: Object}>} Captured image and display bounds
   */
  async captureFullScreen() {
    this.logger.start('captureFullScreen');

    try {
      // Get the cursor position to determine which display to capture
      const cursorPoint = screen.getCursorScreenPoint();
      this.logger.info('Cursor position:', cursorPoint);

      // Get the display at the cursor position (allows capturing any monitor)
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const bounds = display.bounds;
      this.logger.info('Capturing display at cursor with bounds:', bounds);
      this.logger.info('Display id:', display.id);

      // Get all displays to understand the layout
      const allDisplays = screen.getAllDisplays();
      this.logger.info('All displays:');
      allDisplays.forEach((d, i) => {
        this.logger.info(`  Display ${i}: id=${d.id}, bounds=${JSON.stringify(d.bounds)}`);
      });

      // Get the screen source for this display
      const source = await this._getScreenSourceForBounds(bounds);

      if (!source) {
        throw new Error(`No screen source found for display at cursor position`);
      }

      this.logger.info('Full screenshot source:', source.name, 'thumbnail size:', source.thumbnail.getSize());

      // Convert to native image
      const nativeImg = toNativeImage(source.thumbnail.toDataURL());

      // Return as PNG buffer
      const result = {
        image: nativeImg.toPNG(),
        bounds: bounds
      };

      this.logger.success('captureFullScreen');
      return result;

    } catch (error) {
      this.logger.fail('captureFullScreen', error);
      throw error;
    }
  }

  /**
   * Capture a specific area of the screen
   *
   * Supports multi-monitor selections by capturing displays individually
   * and handling selections that may span multiple monitors.
   *
   * @param {Object} selectionBounds - The area to capture {x, y, width, height}
   * @param {boolean} [absoluteCoords=true] - Whether bounds are absolute screen coordinates
   * @returns {Promise<{image: Buffer, bounds: Object}>} Captured image and actual bounds
   */
  async captureArea(selectionBounds, absoluteCoords = true) {
    this.logger.start('captureArea');
    this.logger.info('Selection bounds:', selectionBounds);

    try {
      const allDisplays = screen.getAllDisplays();
      this.logger.info(`Found ${allDisplays.length} display(s)`);

      // Calculate virtual screen bounds
      const virtualBounds = this.getVirtualScreenBounds();
      this.logger.info('Virtual screen bounds:', virtualBounds);

      // Find all displays that intersect with the selection
      const selectionEndX = selectionBounds.x + selectionBounds.width;
      const selectionEndY = selectionBounds.y + selectionBounds.height;

      const intersectingDisplays = allDisplays.filter(display => {
        const displayEndX = display.bounds.x + display.bounds.width;
        const displayEndY = display.bounds.y + display.bounds.height;
        return !(
          selectionEndX < display.bounds.x ||
          selectionBounds.x > displayEndX ||
          selectionEndY < display.bounds.y ||
          selectionBounds.y > displayEndY
        );
      });

      this.logger.info(`Found ${intersectingDisplays.length} intersecting display(s)`);

      if (intersectingDisplays.length === 0) {
        throw new Error('Selection does not intersect with any display');
      }

      // If selection is within a single display, use simple capture
      if (intersectingDisplays.length === 1) {
        return await this._captureSingleDisplay(selectionBounds, intersectingDisplays[0]);
      }

      // Multi-monitor capture - stitch together multiple displays
      return await this._captureMultiDisplay(selectionBounds, intersectingDisplays, virtualBounds);

    } catch (error) {
      this.logger.fail('captureArea', error);
      throw error;
    }
  }

  /**
   * Capture selection from a single display
   *
   * @param {Object} selectionBounds - The area to capture
   * @param {Object} display - The display to capture from
   * @returns {Promise<{image: Buffer, bounds: Object}>} Captured image and bounds
   * @private
   */
  async _captureSingleDisplay(selectionBounds, display) {
    this.logger.info('Single display capture');
    this.logger.info('Selection bounds:', selectionBounds);
    this.logger.info('Display bounds:', display.bounds);

    // Get the screen source for this display at its exact resolution
    const source = await this._getScreenSourceForBounds(display.bounds);

    if (!source) {
      throw new Error(`No screen source found for display: ${JSON.stringify(display.bounds)}`);
    }

    // Get the thumbnail size and actual display size
    const thumbnailSize = source.thumbnail.getSize();

    // Convert thumbnail to PNG to check its size
    const thumbnailPng = source.thumbnail.toPNG();

    // Calculate scaling factor
    // The thumbnail might be larger or smaller than the actual display
    const scaleX = thumbnailSize.width / display.bounds.width;
    const scaleY = thumbnailSize.height / display.bounds.height;

    // Convert selection to display-relative coordinates
    const displayRelativeX = selectionBounds.x - display.bounds.x;
    const displayRelativeY = selectionBounds.y - display.bounds.y;

    // Validate display-relative coordinates are positive
    if (displayRelativeX < 0 || displayRelativeY < 0) {
      this.logger.error('Display-relative coordinates are negative!', { displayRelativeX, displayRelativeY });
      throw new Error(`Invalid display-relative coordinates: x=${displayRelativeX}, y=${displayRelativeY}`);
    }

    // Scale the crop coordinates to match the thumbnail size
    const cropBounds = {
      x: Math.round(displayRelativeX * scaleX),
      y: Math.round(displayRelativeY * scaleY),
      width: Math.round(selectionBounds.width * scaleX),
      height: Math.round(selectionBounds.height * scaleY)
    };

    // Validate crop bounds are within thumbnail bounds
    const cropEndX = cropBounds.x + cropBounds.width;
    const cropEndY = cropBounds.y + cropBounds.height;
    if (cropBounds.x < 0 || cropBounds.y < 0 ||
        cropEndX > thumbnailSize.width || cropEndY > thumbnailSize.height) {
      this.logger.error('Crop bounds exceed thumbnail bounds!', {
        cropBounds,
        thumbnailSize,
        cropEndX,
        cropEndY
      });
      throw new Error(`Invalid crop bounds: crop area exceeds thumbnail bounds`);
    }

    // Crop to selection
    const croppedImage = this._cropToArea(
      thumbnailPng,
      cropBounds,
      thumbnailSize
    );

    this.logger.success('captureArea (single display)');
    return {
      image: croppedImage,
      bounds: selectionBounds
    };
  }

  /**
   * Capture selection spanning multiple displays
   *
   * For multi-monitor selections, we capture each intersecting display
   * and stitch them together into a single image.
   *
   * @param {Object} selectionBounds - The area to capture
   * @param {Array} displays - Array of intersecting displays
   * @param {Object} virtualBounds - Virtual screen bounds
   * @returns {Promise<{image: Buffer, bounds: Object}>} Captured image and bounds
   * @private
   */
  async _captureMultiDisplay(selectionBounds, displays, virtualBounds) {
    this.logger.info('Multi-display capture');
    this.logger.info('Number of intersecting displays:', displays.length);

    // Capture each display that intersects with the selection
    const capturedDisplays = [];

    for (const display of displays) {
      // Calculate intersection between selection and this display
      const intersection = this._calculateIntersection(selectionBounds, display.bounds);

      if (!intersection) {
        continue;
      }

      // Get the screen source for this display at its exact resolution
      const source = await this._getScreenSourceForBounds(display.bounds);

      if (!source) {
        this.logger.warn('Could not get screen source for display:', display.bounds);
        continue;
      }

      // Get the thumbnail size and actual display size
      const thumbnailSize = source.thumbnail.getSize();

      // Calculate scaling factor
      const scaleX = thumbnailSize.width / display.bounds.width;
      const scaleY = thumbnailSize.height / display.bounds.height;

      // Convert intersection to display-relative coordinates
      const displayRelativeX = intersection.x - display.bounds.x;
      const displayRelativeY = intersection.y - display.bounds.y;

      // Scale the crop coordinates to match the thumbnail size
      const cropBounds = {
        x: Math.round(displayRelativeX * scaleX),
        y: Math.round(displayRelativeY * scaleY),
        width: Math.round(intersection.width * scaleX),
        height: Math.round(intersection.height * scaleY)
      };

      // Crop to intersection
      const croppedImage = this._cropToArea(
        source.thumbnail.toPNG(),
        cropBounds,
        thumbnailSize
      );

      // Store with intersection coordinates for positioning
      capturedDisplays.push({
        image: croppedImage,
        x: intersection.x,
        y: intersection.y,
        width: intersection.width,
        height: intersection.height
      });
    }

    if (capturedDisplays.length === 0) {
      throw new Error('No displays could be captured for the selection');
    }

    // If only one display was captured, return it directly
    if (capturedDisplays.length === 1) {
      this.logger.info('Only one display captured, returning directly');
      return {
        image: capturedDisplays[0].image,
        bounds: {
          x: capturedDisplays[0].x,
          y: capturedDisplays[0].y,
          width: capturedDisplays[0].width,
          height: capturedDisplays[0].height
        }
      };
    }

    // Multiple displays captured - stitch them together
    this.logger.info('Multiple displays captured, stitching together');
    return await this._stitchDisplays(selectionBounds, capturedDisplays);
  }

  /**
   * Stitch multiple display captures into a single image
   *
   * Uses Jimp library to composite images without native dependencies.
   *
   * @param {Object} selectionBounds - The original selection bounds
   * @param {Array} capturedDisplays - Array of captured display portions
   * @returns {Promise<{image: Buffer, bounds: Object}>} Stitched image and bounds
   * @private
   */
  async _stitchDisplays(selectionBounds, capturedDisplays) {
    this.logger.info('Stitching displays together');
    this.logger.info('Selection bounds:', selectionBounds);
    this.logger.info('Number of captured displays:', capturedDisplays.length);

    // Create a blank Jimp image at the ORIGINAL selection size (in screen coordinates)
    const stitched = await new Jimp(selectionBounds.width, selectionBounds.height, 'white');

    // Composite each captured display onto the stitched image
    const compositePromises = capturedDisplays.map(async (captured) => {
      // Calculate position relative to selection (in screen coordinates)
      const relativeX = captured.x - selectionBounds.x;
      const relativeY = captured.y - selectionBounds.y;

      // Read the captured image as Jimp
      const jimpImg = await Jimp.read(captured.image);

      // Only resize if the image size doesn't match the expected size
      // Since we now capture at actual display size, this is often unnecessary
      const actualSize = jimpImg.bitmap.width;
      const expectedSize = captured.width;
      if (actualSize !== expectedSize) {
        await jimpImg.resize(captured.width, captured.height);
      }

      // Composite at the correct relative position
      stitched.composite(jimpImg, relativeX, relativeY);
    });

    // Wait for all images to be composited
    await Promise.all(compositePromises);

    // Convert to PNG buffer
    const stitchedBuffer = await stitched.getBufferAsync(Jimp.MIME_PNG);

    return {
      image: stitchedBuffer,
      bounds: {
        x: selectionBounds.x,
        y: selectionBounds.y,
        width: selectionBounds.width,
        height: selectionBounds.height
      }
    };
  }

  /**
   * Calculate intersection between two rectangles
   *
   * @param {Object} rect1 - First rectangle {x, y, width, height}
   * @param {Object} rect2 - Second rectangle {x, y, width, height}
   * @returns {Object|null} Intersection rectangle or null if no intersection
   * @private
   */
  _calculateIntersection(rect1, rect2) {
    const x = Math.max(rect1.x, rect2.x);
    const y = Math.max(rect1.y, rect2.y);
    const width = Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - x;
    const height = Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - y;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }

  /**
   * Adjust crop bounds to ensure they stay within display bounds
   *
   * @param {Object} bounds - The selection bounds
   * @param {Object} displayBounds - The display bounds
   * @returns {Object} Adjusted bounds
   * @private
   */
  _adjustBoundsForDisplay(bounds, displayBounds) {
    return {
      x: Math.max(0, Math.min(bounds.x, displayBounds.width)),
      y: Math.max(0, Math.min(bounds.y, displayBounds.height)),
      width: Math.min(bounds.width, displayBounds.width - bounds.x),
      height: Math.min(bounds.height, displayBounds.height - bounds.y)
    };
  }

  /**
   * Get the bounding box of the entire virtual screen (all monitors)
   *
   * @returns {Object} Virtual screen bounds {x, y, width, height}
   */
  getVirtualScreenBounds() {
    const allDisplays = screen.getAllDisplays();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    allDisplays.forEach((display) => {
      const bounds = display.bounds;
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get the bounding box of the entire virtual screen (all monitors)
   *
   * @returns {Object} Virtual screen bounds {x, y, width, height}
   * @private
   */
  _getVirtualScreenBounds() {
    return this.getVirtualScreenBounds();
  }

  /**
   * Get the screen source that corresponds to a specific display
   *
   * Matches displays to screen sources by sorting both left-to-right
   * by their virtual screen position (x coordinate).
   *
   * @param {Object} displayBounds - The display bounds {x, y, width, height}
   * @returns {Promise<Object>} The matching screen source
   * @private
   */
  async _getScreenSourceForBounds(displayBounds) {
    this.logger.info('Getting screen source for bounds:', displayBounds);

    // Use the actual display size for thumbnail to avoid unnecessary overhead
    // This significantly speeds up capture while maintaining quality
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: displayBounds.width,
        height: displayBounds.height
      }
    });

    if (sources.length === 0) {
      throw new Error('No screen sources found');
    }

    // Get all displays for reference
    const allDisplays = screen.getAllDisplays();

    // Sort displays by x position (left-to-right)
    // This should match the order that desktopCapturer returns sources
    const sortedDisplays = [...allDisplays].sort((a, b) => a.bounds.x - b.bounds.x);

    // Find the index of our target display in the sorted array
    let sortedIndex = sortedDisplays.findIndex(d =>
      d.bounds.x === displayBounds.x &&
      d.bounds.y === displayBounds.y &&
      d.bounds.width === displayBounds.width &&
      d.bounds.height === displayBounds.height
    );

    if (sortedIndex === -1) {
      this.logger.warn('Exact bounds match failed, trying fuzzy match');
      sortedIndex = sortedDisplays.findIndex(d =>
        Math.abs(d.bounds.x - displayBounds.x) <= 1 &&
        Math.abs(d.bounds.y - displayBounds.y) <= 1 &&
        Math.abs(d.bounds.width - displayBounds.width) <= 1 &&
        Math.abs(d.bounds.height - displayBounds.height) <= 1
      );
    }

    // Find the target display object to get its ID
    const targetDisplay = allDisplays.find(d =>
      d.bounds.x === displayBounds.x &&
      d.bounds.y === displayBounds.y &&
      d.bounds.width === displayBounds.width &&
      d.bounds.height === displayBounds.height
    );

    let displayId = targetDisplay ? targetDisplay.id : null;

    // Check if we have a cached mapping for this display
    if (displayId && this.mappingStore.isMapped({ id: displayId })) {
      const cachedIndex = this.mappingStore.getScreenIndex({ id: displayId });
      // Validate the cached index is within bounds and points to a valid source
      if (cachedIndex >= 0 && cachedIndex < sources.length && sources[cachedIndex]) {
        this.logger.info(`Using cached mapping: display ${displayId} → Screen ${cachedIndex + 1}`);
        return sources[cachedIndex];
      } else {
        this.logger.warn(`Cached index ${cachedIndex} is invalid, recalculating`);
      }
    }

    // No cached mapping - need to establish the mapping
    // Use position-based mapping: sort displays by x position and map to screen sources in order
    this.logger.info('Establishing display-to-source mapping');

    // Map each display to a screen source by index
    for (let i = 0; i < sortedDisplays.length; i++) {
      const display = sortedDisplays[i];
      if (i < sources.length) {
        this.mappingStore.setScreenIndex(display, i);
      }
    }

    // Find the screen source for our target display
    const displayIndexInSorted = sortedDisplays.findIndex(d => d.id === displayId);
    if (displayIndexInSorted >= 0 && displayIndexInSorted < sources.length) {
      const source = sources[displayIndexInSorted];
      this.logger.info(`Match: display ${displayId} → Screen ${displayIndexInSorted + 1}`);
      return source;
    }

    // No matching source found - use fallback
    this.logger.error('No suitable screen source found for display:', displayBounds);

    // Use first source as fallback
    return sources[0];
  }

  /**
   * Crop a captured image to a specific area
   *
   * @param {Buffer} image - The captured image buffer
   * @param {Object} areaBounds - The area to crop to {x, y, width, height}
   * @param {Object} displayBounds - The original display bounds
   * @returns {Buffer} The cropped image buffer
   * @private
   */
  _cropToArea(image, areaBounds, displayBounds) {
    this.logger.info('Cropping to area:', areaBounds);

    // Convert buffer to native image
    const nativeImg = toNativeImage(image);
    const imageSize = nativeImg.getSize();

    // Validate crop bounds
    if (!validateCropBounds(areaBounds, imageSize)) {
      this.logger.error('Invalid crop bounds', {
        crop: areaBounds,
        image: imageSize
      });
      throw new Error('Selection bounds are outside the captured image area');
    }

    // Perform the crop
    const cropped = cropImage(nativeImg, areaBounds);
    const croppedBuffer = cropped.toPNG();

    if (cropped.isEmpty()) {
      throw new Error('Cropped image is empty - crop operation failed');
    }

    this.logger.info('Crop complete, size:', cropped.getSize());
    return croppedBuffer;
  }

  /**
   * Get all available displays
   *
   * @returns {Array<Object>} Array of display information objects
   */
  getAllDisplays() {
    return screen.getAllDisplays();
  }

  /**
   * Get the primary display
   *
   * @returns {Object} Primary display information
   */
  getPrimaryDisplay() {
    return screen.getPrimaryDisplay();
  }

  /**
   * Get the display nearest to a point
   *
   * @param {Object} point - Point coordinates {x, y}
   * @returns {Object} Display information
   */
  getDisplayNearestPoint(point) {
    return screen.getDisplayNearestPoint(point);
  }

  /**
   * Get the current cursor screen position
   *
   * @returns {Object} Cursor position {x, y}
   */
  getCursorScreenPoint() {
    return screen.getCursorScreenPoint();
  }
}

module.exports = ScreenshotCapture;
