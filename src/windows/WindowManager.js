/**
 * WindowManager.js - Centralized window management
 *
 * Creates and manages all application windows including:
 * - Main window (home screen)
 * - Selection window (area selection)
 * - Preview window (annotation/editing)
 * - Gallery window (screenshot library)
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { createLogger } = require('../utils/logger');

class WindowManager {
  /**
   * Create a new WindowManager
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.iconPath] - Path to application icon
   */
  constructor(options = {}) {
    this.logger = createLogger('WindowManager');
    this.iconPath = options.iconPath || path.join(__dirname, '../../assets', 'icon.png');

    // Window references
    this.mainWindow = null;
    this.selectionWindow = null;
    this.selectionWindows = [];
    this.previewWindow = null;
    this.galleryWindow = null;
  }

  /**
   * Create or show the main window
   *
   * The main window is the home screen with action buttons.
   *
   * @returns {BrowserWindow} The main window instance
   */
  createMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      return this.mainWindow;
    }

    this.logger.start('createMainWindow');

    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 350,
      center: true,
      frame: true,
      resizable: true,
      alwaysOnTop: false,
      show: true,
      skipTaskbar: false,
      icon: this.iconPath,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.mainWindow.loadFile('index.html');

    // Hide instead of close (keep app running in tray)
    this.mainWindow.on('close', (event) => {
      if (!this.mainWindow._isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.logger.success('createMainWindow');
    return this.mainWindow;
  }

  /**
   * Create or show the selection window
   *
   * The selection window covers all screens for area selection.
   * This allows selections to span across multiple monitors.
   *
   * Creates a separate window for each monitor and synchronizes mouse events.
   *
   * @returns {Array<BrowserWindow>} The selection window instances
   */
  createSelectionWindow() {
    // Close existing selection windows if any
    this.closeSelectionWindow();

    this.logger.start('createSelectionWindow');

    // Get all displays
    const allDisplays = screen.getAllDisplays();
    this.logger.info(`Found ${allDisplays.length} display(s)`);

    // Store selection windows in an array
    this.selectionWindow = [];
    this.selectionWindows = [];

    // Calculate virtual bounds for multi-monitor coordinate system
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    allDisplays.forEach((display) => {
      const bounds = display.bounds;
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });

    const virtualBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    this.logger.info('Virtual screen bounds:', virtualBounds);

    // Create a window for each display
    allDisplays.forEach((display, index) => {
      this.logger.info(`Creating selection window for display ${index}:`, display.bounds);

      const win = new BrowserWindow({
        width: display.bounds.width,
        height: display.bounds.height,
        x: display.bounds.x,
        y: display.bounds.y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        enableLargerThanScreen: true,  // Allow window to span multiple monitors
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: false
        }
      });

      // Enable mouse events with forwarding to allow smooth cross-monitor selection
      // This allows the window to pass through mouse events when needed
      win.setIgnoreMouseEvents(false, { forward: true });

      win.loadFile('selection.html');

      // Send display info when ready
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('init-display-info', {
          displayIndex: index,
          totalDisplays: allDisplays.length,
          displayBounds: display.bounds,
          virtualBounds: virtualBounds,
          allDisplays: allDisplays.map(d => d.bounds)
        });
      });

      // Show when ready - ensure all windows are visible and on top
      win.once('ready-to-show', () => {
        win.show();
        win.setAlwaysOnTop(true);
        // Ensure window stays on top and is visible
        win.moveTop();

        // Only focus the first window initially
        if (index === 0) {
          win.focus();
        }
      });

      // Handle errors
      win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        this.logger.error(`Selection window ${index} failed to load:`, errorDescription);
      });

      // Clean up on close
      win.on('closed', () => {
        this.selectionWindows = this.selectionWindows.filter(w => w !== win);
        if (this.selectionWindows.length === 0) {
          this.selectionWindow = null;
        }
      });

      this.selectionWindows.push(win);
    });

    // Maintain backward compatibility by setting first window as selectionWindow
    this.selectionWindow = this.selectionWindows[0];

    this.logger.success('createSelectionWindow');
    return this.selectionWindows;
  }

  /**
   * Create a new preview window for editing
   *
   * The preview window shows the captured screenshot with annotation tools.
   *
   * @param {Buffer|string} imageData - The screenshot image data
   * @param {Object} bounds - The capture bounds
   * @param {string} [filePath] - Optional file path if editing existing screenshot
   * @returns {BrowserWindow} The preview window instance
   */
  createPreviewWindow(imageData, bounds, filePath = null) {
    try {
      this.logger.start('createPreviewWindow');

      // Close existing preview window
      this.closePreviewWindow();

      this.previewWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: true,
        alwaysOnTop: true,
        resizable: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      this.previewWindow.loadFile('preview.html');

      // Track if the window has loaded
      let hasLoaded = false;
      let hasShown = false;

      // Send image data when window is ready
      this.previewWindow.webContents.on('did-finish-load', () => {
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          const dataUrl = this._convertToDataUrl(imageData);
          this.previewWindow.webContents.send('load-image', {
            imageData: dataUrl,
            bounds: bounds,
            filePath: filePath
          });
          hasLoaded = true;
        }
      });

      // Show when ready
      this.previewWindow.once('ready-to-show', () => {
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.previewWindow.show();
          this.previewWindow.focus();
          hasShown = true;
        }
      });

      // Handle errors
      this.previewWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        this.logger.error('Preview window failed to load:', errorCode, errorDescription);
      });

      // Clean up on close
      this.previewWindow.on('closed', () => {
        this.previewWindow = null;
      });

      // Add timeout to detect if window fails to load
      setTimeout(() => {
        if (!hasLoaded && this.previewWindow && !this.previewWindow.isDestroyed()) {
          this.logger.warn('Preview window did not load, forcing show...');
          if (!hasShown) {
            this.previewWindow.show();
            this.previewWindow.focus();
          }
        }
      }, 5000);

      this.logger.success('createPreviewWindow');
      return this.previewWindow;
    } catch (error) {
      this.logger.error('Error in createPreviewWindow:', error);
      throw error;
    }
  }

  /**
   * Create or show the gallery window
   *
   * The gallery window displays all saved screenshots.
   *
   * @returns {BrowserWindow} The gallery window instance
   */
  createGalleryWindow() {
    if (this.galleryWindow) {
      this.galleryWindow.focus();
      return this.galleryWindow;
    }

    this.logger.start('createGalleryWindow');

    this.galleryWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      frame: true,
      resizable: true,
      title: 'Screenshot Gallery',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.galleryWindow.loadFile('gallery.html');

    // Clean up on close
    this.galleryWindow.on('closed', () => {
      this.galleryWindow = null;
    });

    this.logger.success('createGalleryWindow');
    return this.galleryWindow;
  }

  /**
   * Close the selection window(s)
   */
  closeSelectionWindow() {
    if (this.selectionWindows && this.selectionWindows.length > 0) {
      this.selectionWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.close();
        }
      });
      this.selectionWindows = [];
      this.selectionWindow = null;
    } else if (this.selectionWindow) {
      this.selectionWindow.close();
      this.selectionWindow = null;
    }
  }

  /**
   * Close the preview window
   */
  closePreviewWindow() {
    if (this.previewWindow) {
      this.previewWindow.close();
      this.previewWindow = null;
    }
  }

  /**
   * Hide the selection window(s) temporarily (for screenshot capture)
   */
  hideSelectionWindow() {
    if (this.selectionWindows && this.selectionWindows.length > 0) {
      this.selectionWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.hide();
        }
      });
    } else if (this.selectionWindow) {
      this.selectionWindow.hide();
    }
  }

  /**
   * Get the main window
   *
   * @returns {BrowserWindow|null} The main window or null if not created
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * Get the selection window(s)
   *
   * @returns {BrowserWindow|Array<BrowserWindow>|null} The selection window(s) or null if not created
   */
  getSelectionWindow() {
    return this.selectionWindows || this.selectionWindow;
  }

  /**
   * Get the preview window
   *
   * @returns {BrowserWindow|null} The preview window or null if not created
   */
  getPreviewWindow() {
    return this.previewWindow;
  }

  /**
   * Get the gallery window
   *
   * @returns {BrowserWindow|null} The gallery window or null if not created
   */
  getGalleryWindow() {
    return this.galleryWindow;
  }

  /**
   * Signal that the app is quitting (prevents window close from hiding)
   */
  setQuitting() {
    if (this.mainWindow) {
      this.mainWindow._isQuitting = true;
    }
  }

  /**
   * Close all windows
   */
  closeAllWindows() {
    this.closeSelectionWindow();
    this.closePreviewWindow();
    if (this.galleryWindow) {
      this.galleryWindow.close();
    }
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  }

  /**
   * Convert image data to base64 data URL for IPC
   *
   * @param {Buffer|string} imageData - The image data
   * @returns {string} Base64 data URL
   * @private
   */
  _convertToDataUrl(imageData) {
    if (Buffer.isBuffer(imageData)) {
      const base64 = imageData.toString('base64');
      return 'data:image/png;base64,' + base64;
    } else if (typeof imageData === 'string') {
      // Already a data URL or base64 string
      if (imageData.includes(',')) {
        return imageData;
      }
      return 'data:image/png;base64,' + imageData;
    }
    return imageData;
  }
}

module.exports = WindowManager;
