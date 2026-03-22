/**
 * TrayManager.js - System tray icon and menu management
 *
 * Creates and manages the system tray icon with context menu.
 * The tray allows the app to run in the background and provides
 * quick access to screenshot functions.
 */

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { createLogger } = require('../utils/logger');

class TrayManager {
  /**
   * Create a new TrayManager
   *
   * @param {Object} options - Configuration options
   * @param {Function} [options.onTakeScreenshot] - Callback for take screenshot action
   * @param {Function} [options.onCaptureFullScreen] - Callback for full screen capture
   * @param {Function} [options.onOpenGallery] - Callback for opening gallery
   * @param {Function} [options.onQuit] - Callback for quit action
   * @param {string} [options.iconPath] - Path to tray icon
   */
  constructor(options = {}) {
    this.logger = createLogger('TrayManager');
    this.tray = null;
    this.iconPath = options.iconPath || path.join(__dirname, '../../assets', 'icon.png');

    // Action callbacks
    this.onTakeScreenshot = options.onTakeScreenshot || (() => {});
    this.onCaptureFullScreen = options.onCaptureFullScreen || (() => {});
    this.onOpenGallery = options.onOpenGallery || (() => {});
    this.onQuit = options.onQuit || (() => {});
  }

  /**
   * Create and initialize the system tray icon
   *
   * Loads the icon, creates the context menu, and sets up event handlers.
   */
  create() {
    this.logger.start('createTray');

    try {
      // Load and resize icon for tray (tray icons should be small)
      const trayIcon = nativeImage.createFromPath(this.iconPath);
      trayIcon.resize({ width: 16, height: 16 });

      this.tray = new Tray(trayIcon);
      this.logger.info('Tray icon created from:', this.iconPath);

      // Create context menu
      this._createContextMenu();

      // Set tooltip
      this.tray.setToolTip('MauShot');

      // Handle tray icon click (left click)
      this.tray.on('click', () => {
        this.logger.info('Tray icon clicked');
        this.onTakeScreenshot();
      });

      this.logger.success('createTray');

    } catch (error) {
      this.logger.fail('createTray', error);
    }
  }

  /**
   * Destroy the tray icon
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.logger.info('Tray icon destroyed');
    }
  }

  /**
   * Set a tooltip for the tray icon
   *
   * @param {string} tooltip - The tooltip text
   */
  setToolTip(tooltip) {
    if (this.tray) {
      this.tray.setToolTip(tooltip);
    }
  }

  /**
   * Get the tray instance
   *
   * @returns {Tray|null} The Electron Tray instance
   */
  getTray() {
    return this.tray;
  }

  /**
   * Check if tray is available
   *
   * @returns {boolean} True if tray exists
   */
  isAvailable() {
    return this.tray !== null;
  }

  /**
   * Create the context menu for the tray icon
   *
   * @private
   */
  _createContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Take Screenshot',
        click: () => {
          this.logger.info('Tray: Take Screenshot clicked');
          this.onTakeScreenshot();
        }
      },
      {
        label: 'Capture Full Screen',
        click: () => {
          this.logger.info('Tray: Capture Full Screen clicked');
          this.onCaptureFullScreen();
        }
      },
      { type: 'separator' },
      {
        label: 'Open Gallery',
        click: () => {
          this.logger.info('Tray: Open Gallery clicked');
          this.onOpenGallery();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.logger.info('Tray: Quit clicked');
          this.onQuit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}

module.exports = TrayManager;
