/**
 * StorageManager.js - High-level file storage operations
 *
 * Manages saving screenshots, creating thumbnails, and file operations.
 * Provides a clean interface between the app and the file system.
 */

const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');
const { getScreenshotsPath, getThumbnailPath } = require('../utils/paths');
const { createThumbnail, toPngBuffer } = require('../utils/imageHelpers');
const { createLogger } = require('../utils/logger');
const ScreenshotStore = require('./ScreenshotStore');

class StorageManager {
  /**
   * Create a new StorageManager
   *
   * @param {string} [screenshotsDir] - Optional custom screenshots directory
   */
  constructor(screenshotsDir = null) {
    this.screenshotsPath = screenshotsDir || getScreenshotsPath();
    this.metadataPath = path.join(this.screenshotsPath, 'metadata.json');
    this.store = new ScreenshotStore(this.metadataPath);
    this.logger = createLogger('StorageManager');
  }

  /**
   * Ensure the screenshots directory exists
   *
   * Creates the directory and any necessary parent directories.
   */
  ensureDirectory() {
    if (!fs.existsSync(this.screenshotsPath)) {
      fs.mkdirSync(this.screenshotsPath, { recursive: true });
      this.logger.info('Created screenshots directory:', this.screenshotsPath);
    }
  }

  /**
   * Save a screenshot to disk
   *
   * Saves the image data, creates a thumbnail, and adds to the store.
   *
   * @param {Buffer|string} imageData - The image data as Buffer or base64 string
   * @param {string} [filename] - Optional filename (auto-generated if not provided)
   * @returns {Object} The screenshot metadata object
   */
  saveScreenshot(imageData, filename = null) {
    this.logger.start('saveScreenshot');

    // Ensure directory exists
    this.ensureDirectory();

    // Generate filename if not provided
    const fileName = filename || this._generateFilename();
    const filePath = path.join(this.screenshotsPath, fileName);

    // Convert to PNG buffer
    const buffer = toPngBuffer(imageData);

    // Save the screenshot file
    fs.writeFileSync(filePath, buffer);
    this.logger.info('Screenshot saved:', filePath);

    // Create and save thumbnail
    const thumbnailPath = this._createAndSaveThumbnail(buffer, fileName);

    // Add to store
    const screenshot = this.store.addScreenshot(filePath, thumbnailPath);

    this.logger.success('saveScreenshot');
    return screenshot;
  }

  /**
   * Delete a screenshot and its files
   *
   * @param {string} id - The screenshot ID to delete
   * @returns {boolean} True if deleted, false if not found
   */
  deleteScreenshot(id) {
    this.logger.info('Deleting screenshot:', id);
    return this.store.deleteScreenshot(id);
  }

  /**
   * Get all screenshots from the store
   *
   * @returns {Array<Object>} Array of screenshot metadata objects
   */
  getAllScreenshots() {
    return this.store.getScreenshots();
  }

  /**
   * Get a screenshot by ID
   *
   * @param {string} id - The screenshot ID
   * @returns {Object|null} The screenshot metadata or null if not found
   */
  getScreenshot(id) {
    return this.store.getScreenshotById(id);
  }

  /**
   * Check if a screenshot file exists
   *
   * @param {string} filePath - Path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * Read a screenshot file as buffer
   *
   * @param {string} filePath - Path to the screenshot file
   * @returns {Buffer} The file contents
   */
  readFile(filePath) {
    return fs.readFileSync(filePath);
  }

  /**
   * Get the screenshots directory path
   *
   * @returns {string} The path to the screenshots directory
   */
  getScreenshotsPath() {
    return this.screenshotsPath;
  }

  /**
   * Get the storage statistics
   *
   * @returns {Object} Statistics about the storage {count, totalSize}
   */
  getStats() {
    const screenshots = this.getAllScreenshots();
    let totalSize = 0;

    screenshots.forEach(s => {
      try {
        const stats = fs.statSync(s.filePath);
        totalSize += stats.size;
      } catch (error) {
        // File might not exist, skip
      }
    });

    return {
      count: screenshots.length,
      totalSize: totalSize
    };
  }

  /**
   * Generate a unique filename for a screenshot
   *
   * @returns {string} A filename with timestamp
   * @private
   */
  _generateFilename() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `Screenshot_${month}-${day}-${year}_${hours}-${minutes}-${seconds}.png`;
  }

  /**
   * Create and save a thumbnail for a screenshot
   *
   * @param {Buffer} imageBuffer - The original image buffer
   * @param {string} filename - The original filename
   * @returns {string} Path to the saved thumbnail
   * @private
   */
  _createAndSaveThumbnail(imageBuffer, filename) {
    // getThumbnailPath already includes the full path
    const thumbnailPath = getThumbnailPath(filename, this.screenshotsPath);

    const thumbnailBuffer = createThumbnail(imageBuffer, 200);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    this.logger.info('Thumbnail saved:', thumbnailPath);
    return thumbnailPath;
  }
}

module.exports = StorageManager;
