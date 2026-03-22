/**
 * ScreenshotStore.js - Screenshot metadata management
 *
 * Handles storing, retrieving, and managing screenshot metadata.
 * Provides a simple in-memory store with disk persistence.
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

class ScreenshotStore {
  /**
   * Create a new ScreenshotStore
   *
   * @param {string} metadataPath - Full path to the metadata JSON file
   */
  constructor(metadataPath) {
    this.path = metadataPath;
    this.screenshots = [];
    this.logger = createLogger('ScreenshotStore');
    this.load();
  }

  /**
   * Load screenshots from disk
   *
   * Reads the metadata file and populates the screenshots array.
   * Creates a new metadata file if one doesn't exist.
   */
  load() {
    try {
      if (fs.existsSync(this.path)) {
        const data = fs.readFileSync(this.path, 'utf-8');
        this.screenshots = JSON.parse(data);
        this.logger.info(`Loaded ${this.screenshots.length} screenshots from metadata`);
      } else {
        this.logger.info('No existing metadata file found, starting fresh');
        this.screenshots = [];
        this._createMetadataFile();
      }
    } catch (error) {
      this.logger.error('Error loading metadata', error);
      this.screenshots = [];
    }
  }

  /**
   * Save screenshots to disk
   *
   * Writes the current screenshots array to the metadata file.
   */
  save() {
    try {
      this.logger.debug('Saving metadata to:', this.path);
      fs.writeFileSync(this.path, JSON.stringify(this.screenshots, null, 2));
      this.logger.debug('Metadata saved successfully');
    } catch (error) {
      this.logger.error('Error saving metadata', error);
    }
  }

  /**
   * Add a new screenshot to the store
   *
   * @param {string} filePath - Path to the screenshot file
   * @param {string} thumbnailPath - Path to the thumbnail file
   * @returns {Object} The screenshot metadata object
   */
  addScreenshot(filePath, thumbnailPath) {
    try {
      const stats = fs.statSync(filePath);
      const screenshot = {
        id: this._generateId(),
        filePath: filePath,
        thumbnailPath: thumbnailPath,
        createdAt: stats.birthtime.toISOString(),
        name: path.basename(filePath)
      };

      // Add to beginning of array (newest first)
      this.screenshots.unshift(screenshot);
      this.save();

      this.logger.info('Screenshot added to store:', screenshot.name);
      return screenshot;

    } catch (error) {
      this.logger.error('Error adding screenshot to store', error);

      // Fallback: create entry without file stats
      const screenshot = {
        id: this._generateId(),
        filePath: filePath,
        thumbnailPath: thumbnailPath,
        createdAt: new Date().toISOString(),
        name: path.basename(filePath)
      };

      this.screenshots.unshift(screenshot);
      this.save();
      return screenshot;
    }
  }

  /**
   * Delete a screenshot from the store
   *
   * Deletes both the metadata entry and the associated files.
   *
   * @param {string} id - The screenshot ID to delete
   * @returns {boolean} True if deleted, false if not found
   */
  deleteScreenshot(id) {
    const index = this.screenshots.findIndex(s => s.id === id);

    if (index === -1) {
      this.logger.warn('Screenshot not found for deletion:', id);
      return false;
    }

    const screenshot = this.screenshots[index];

    // Delete the actual files
    this._deleteFile(screenshot.filePath);
    this._deleteFile(screenshot.thumbnailPath);

    // Remove from array and save
    this.screenshots.splice(index, 1);
    this.save();

    this.logger.info('Screenshot deleted:', screenshot.name);
    return true;
  }

  /**
   * Get all screenshots from the store
   *
   * @returns {Array<Object>} Array of screenshot metadata objects
   */
  getScreenshots() {
    return this.screenshots;
  }

  /**
   * Get a single screenshot by ID
   *
   * @param {string} id - The screenshot ID
   * @returns {Object|null} The screenshot metadata or null if not found
   */
  getScreenshotById(id) {
    return this.screenshots.find(s => s.id === id) || null;
  }

  /**
   * Update an existing screenshot
   *
   * @param {string} id - The screenshot ID to update
   * @param {Object} updates - Object containing fields to update
   * @returns {boolean} True if updated, false if not found
   */
  updateScreenshot(id, updates) {
    const index = this.screenshots.findIndex(s => s.id === id);

    if (index === -1) {
      return false;
    }

    this.screenshots[index] = {
      ...this.screenshots[index],
      ...updates
    };

    this.save();
    return true;
  }

  /**
   * Generate a unique ID for a screenshot
   *
   * @returns {string} A unique ID based on timestamp
   * @private
   */
  _generateId() {
    return Date.now().toString();
  }

  /**
   * Create the metadata file if it doesn't exist
   *
   * @private
   */
  _createMetadataFile() {
    try {
      const dir = path.dirname(this.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.path, JSON.stringify([], null, 2));
      this.logger.info('Metadata file created at:', this.path);
    } catch (error) {
      this.logger.error('Error creating metadata file', error);
    }
  }

  /**
   * Safely delete a file if it exists
   *
   * @param {string} filePath - Path to the file to delete
   * @private
   */
  _deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.error('Error deleting file:', filePath, error);
    }
  }
}

module.exports = ScreenshotStore;
