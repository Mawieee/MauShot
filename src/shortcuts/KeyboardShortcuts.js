/**
 * KeyboardShortcuts.js - Global keyboard shortcut management
 *
 * Registers and manages global keyboard shortcuts for the application.
 * Shortcuts work even when the application is not focused.
 */

const { globalShortcut } = require('electron');
const { createLogger } = require('../utils/logger');

class KeyboardShortcuts {
  /**
   * Create a new KeyboardShortcuts manager
   */
  constructor() {
    this.logger = createLogger('KeyboardShortcuts');
    this.registeredShortcuts = new Map();
  }

  /**
   * Register a keyboard shortcut
   *
   * @param {string} accelerator - The key combination (e.g., 'CommandOrControl+Shift+A')
   * @param {Function} callback - Function to call when shortcut is triggered
   * @param {string} [name] - Descriptive name for logging
   * @returns {boolean} True if registration was successful
   */
  register(accelerator, callback, name = 'unnamed') {
    try {
      const success = globalShortcut.register(accelerator, callback);

      if (success) {
        this.registeredShortcuts.set(accelerator, { callback, name });
        this.logger.info(`Registered shortcut: ${accelerator} (${name})`);
      } else {
        this.logger.warn(`Failed to register shortcut: ${accelerator} (${name})`);
      }

      return success;

    } catch (error) {
      this.logger.error(`Error registering shortcut ${accelerator}:`, error);
      return false;
    }
  }

  /**
   * Register multiple shortcuts from a configuration array
   *
   * @param {Array<Object>} shortcuts - Array of shortcut definitions
   * @param {string} shortcuts[].accelerator - Key combination
   * @param {Function} shortcuts[].callback - Handler function
   * @param {string} shortcuts[].name - Descriptive name
   * @returns {Object} Statistics about registration {total, successful, failed}
   */
  registerAll(shortcuts) {
    this.logger.info(`Registering ${shortcuts.length} shortcuts...`);

    let successCount = 0;
    let failCount = 0;

    shortcuts.forEach(({ accelerator, callback, name }) => {
      if (this.register(accelerator, callback, name)) {
        successCount++;
      } else {
        failCount++;
      }
    });

    const result = {
      total: shortcuts.length,
      successful: successCount,
      failed: failCount
    };

    this.logger.info('Shortcut registration complete:', result);

    if (successCount === 0) {
      this.logger.warn('No shortcuts were registered successfully');
    }

    return result;
  }

  /**
   * Unregister a specific shortcut
   *
   * @param {string} accelerator - The key combination to unregister
   * @returns {boolean} True if unregistered, false if not found
   */
  unregister(accelerator) {
    const wasRegistered = this.registeredShortcuts.has(accelerator);

    if (wasRegistered) {
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(accelerator);
      this.logger.info(`Unregistered shortcut: ${accelerator}`);
    }

    return wasRegistered;
  }

  /**
   * Unregister all registered shortcuts
   *
   * Call this when the app is quitting to clean up.
   */
  unregisterAll() {
    this.logger.start('unregisterAll');

    globalShortcut.unregisterAll();
    const count = this.registeredShortcuts.size;
    this.registeredShortcuts.clear();

    this.logger.info(`Unregistered ${count} shortcuts`);
    this.logger.success('unregisterAll');
  }

  /**
   * Check if a shortcut is registered
   *
   * @param {string} accelerator - The key combination to check
   * @returns {boolean} True if the shortcut is registered
   */
  isRegistered(accelerator) {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered shortcuts
   *
   * @returns {Array<Object>} Array of registered shortcut info
   */
  getRegisteredShortcuts() {
    return Array.from(this.registeredShortcuts.entries()).map(([accelerator, info]) => ({
      accelerator,
      name: info.name
    }));
  }

  /**
   * Get the count of registered shortcuts
   *
   * @returns {number} Number of registered shortcuts
   */
  getCount() {
    return this.registeredShortcuts.size;
  }
}

module.exports = KeyboardShortcuts;
