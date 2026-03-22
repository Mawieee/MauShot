/**
 * DisplayMappingStore.js - Display to screen source mapping
 *
 * Persists the mapping between physical displays and screen sources.
 * This is needed because Electron's desktopCapturer API doesn't
 * provide reliable display identification on Windows.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createLogger } = require('../utils/logger');

class DisplayMappingStore {
  constructor() {
    this.logger = createLogger('DisplayMappingStore');
    // Store in app data directory
    const userDataPath = app.getPath('userData');
    this.mappingPath = path.join(userDataPath, 'display-mapping.json');
    this.mappings = {};
    this.load();
  }

  /**
   * Load mappings from disk
   */
  load() {
    try {
      if (fs.existsSync(this.mappingPath)) {
        const data = fs.readFileSync(this.mappingPath, 'utf-8');
        this.mappings = JSON.parse(data);
        this.logger.info('Loaded display mappings:', this.mappings);
      } else {
        this.logger.info('No existing display mapping found, starting fresh');
        this.mappings = {};
        this.save();
      }
    } catch (error) {
      this.logger.error('Error loading display mappings', error);
      this.mappings = {};
    }
  }

  /**
   * Save mappings to disk
   */
  save() {
    try {
      const dir = path.dirname(this.mappingPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.mappingPath, JSON.stringify(this.mappings, null, 2));
      this.logger.debug('Display mappings saved');
    } catch (error) {
      this.logger.error('Error saving display mappings', error);
    }
  }

  /**
   * Get the screen source index for a display
   * @param {Object} display - Display object with id and bounds
   * @returns {number|null} Screen source index or null if not mapped
   */
  getScreenIndex(display) {
    const key = this._getMappingKey(display);
    return this.mappings[key] || null;
  }

  /**
   * Set the screen source index for a display
   * @param {Object} display - Display object with id and bounds
   * @param {number} screenIndex - Screen source index
   */
  setScreenIndex(display, screenIndex) {
    const key = this._getMappingKey(display);
    this.mappings[key] = screenIndex;
    this.logger.info(`Mapped display ${display.id} to screen source ${screenIndex}`);
    this.save();
  }

  /**
   * Check if a display is mapped
   * @param {Object} display - Display object with id and bounds
   * @returns {boolean} True if mapped
   */
  isMapped(display) {
    const key = this._getMappingKey(display);
    return this.mappings.hasOwnProperty(key);
  }

  /**
   * Generate a unique key for the display mapping
   * Uses display ID as the primary key
   * @param {Object} display - Display object
   * @returns {string} Mapping key
   * @private
   */
  _getMappingKey(display) {
    return String(display.id);
  }

  /**
   * Clear all mappings (useful for testing)
   */
  clearAll() {
    this.mappings = {};
    this.save();
    this.logger.info('All display mappings cleared');
  }

  /**
   * Get all mappings
   * @returns {Object} All mappings
   */
  getAll() {
    return { ...this.mappings };
  }
}

module.exports = DisplayMappingStore;
