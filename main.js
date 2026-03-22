/**
 * main.js - Application entry point
 *
 * Initializes the Electron application and coordinates all modules.
 * This is the main process entry point for the screenshot application.
 */

const { app, ipcMain, clipboard, BrowserWindow } = require('electron');
const path = require('path');

// Handle Squirrel installer events on Windows (electron-builder).
// These fire during install/update/uninstall — quit immediately so the
// installer can finish without a window popping up.
if (process.platform === 'win32') {
  const squirrelCommand = process.argv[1];
  if (
    squirrelCommand === '--squirrel-install' ||
    squirrelCommand === '--squirrel-updated' ||
    squirrelCommand === '--squirrel-uninstall' ||
    squirrelCommand === '--squirrel-obsolete'
  ) {
    app.quit();
  }
}

// Import custom modules
const WindowManager = require('./src/windows/WindowManager');
const TrayManager = require('./src/ui/TrayManager');
const KeyboardShortcuts = require('./src/shortcuts/KeyboardShortcuts');
const ScreenshotCapture = require('./src/capture/ScreenshotCapture');
const StorageManager = require('./src/storage/StorageManager');
const { toNativeImage, toDataUrl } = require('./src/utils/imageHelpers');
const { getScreenshotsPath } = require('./src/utils/paths');
const { createLogger } = require('./src/utils/logger');

// Global logger
const logger = createLogger('App');

/**
 * Application class - Manages the entire application lifecycle
 */
class ScreenshotApplication {
  /**
   * Create and initialize the application
   */
  constructor() {
    logger.start('ScreenshotApplication.init');

    // Initialize core managers
    this.windowManager = new WindowManager({
      iconPath: path.join(__dirname, 'assets', 'icon.png')
    });

    this.trayManager = new TrayManager({
      iconPath: path.join(__dirname, 'assets', 'icon.png'),
      onTakeScreenshot: () => this.startSelection(),
      onCaptureFullScreen: () => this.captureFullScreen(),
      onOpenGallery: () => this.windowManager.createGalleryWindow(),
      onQuit: () => this.quit()
    });

    this.shortcuts = new KeyboardShortcuts();
    this.capture = new ScreenshotCapture();

    // Initialize storage with screenshots directory
    const screenshotsPath = getScreenshotsPath();
    this.storage = new StorageManager(screenshotsPath);
    this.storage.ensureDirectory();

    // State tracking
    this.isQuitting = false;

    // Bind methods to preserve context
    this._setupIpcHandlers();

    logger.success('ScreenshotApplication.init');
  }

  /**
   * Set up all IPC (Inter-Process Communication) handlers
   * These handle messages from renderer processes
   *
   * @private
   */
  _setupIpcHandlers() {
    // Track if a capture is already in progress
    let isCapturing = false;
    let lastCaptureTime = 0;
    const CAPTURE_DEBOUNCE_MS = 500;

    /**
     * Handle selection complete - user has selected an area to capture
     */
    ipcMain.on('selection-complete', async (event, data) => {
      const now = Date.now();

      // Debounce: prevent duplicate captures within 500ms
      if (isCapturing || (now - lastCaptureTime < CAPTURE_DEBOUNCE_MS)) {
        logger.info('Ignoring duplicate or too-recent selection-complete event');
        return;
      }

      isCapturing = true;
      lastCaptureTime = now;

      logger.start('selection-complete');

      try {
        // Check if windowManager exists
        if (!this.windowManager) {
          throw new Error('WindowManager is not initialized');
        }

        // Hide selection window first (to avoid capturing it)
        this.windowManager.hideSelectionWindow();

        // Wait for window to fully disappear (reduced from 150ms for faster capture)
        await this._delay(50);

        // Capture the selected area
        const result = await this.capture.captureArea(
          data.bounds,
          data.absoluteCoords !== false // Default to true
        );

        // Validate the result
        if (!result || !result.image) {
          throw new Error('Capture result is missing image data');
        }

        // Check if the image buffer is valid
        if (!Buffer.isBuffer(result.image) || result.image.length === 0) {
          throw new Error('Invalid image buffer: length=' + (result.image?.length || 'undefined'));
        }

        // Close selection window completely
        this.windowManager.closeSelectionWindow();

        // Open preview window with captured image
        this.windowManager.createPreviewWindow(result.image, result.bounds);

        logger.success('selection-complete');

      } catch (error) {
        logger.error('Error in selection-complete handler:', error);
        logger.error('Error stack:', error.stack);
        this.windowManager?.closeSelectionWindow();
      } finally {
        // Reset capturing flag after completion (or error)
        setTimeout(() => {
          isCapturing = false;
        }, CAPTURE_DEBOUNCE_MS);
      }
    });

    /**
     * Handle selection cancelled - user cancelled area selection
     */
    ipcMain.on('selection-cancelled', () => {
      logger.info('Selection cancelled by user');
      this.windowManager.closeSelectionWindow();
    });

    /**
     * Handle debug log messages from renderer processes
     */
    ipcMain.on('debug-log', (event, message) => {
      logger.info('[Renderer]', message);
    });

    /**
     * Handle copy to clipboard request
     */
    ipcMain.on('copy-to-clipboard', (event, imageData) => {
      try {
        const image = toNativeImage(imageData);
        clipboard.writeImage(image);
        logger.info('Image copied to clipboard');
      } catch (error) {
        logger.error('Error copying to clipboard:', error);
      }
    });

    /**
     * Handle open gallery request
     */
    ipcMain.on('open-gallery', () => {
      this.windowManager.createGalleryWindow();
    });

    /**
     * Handle area screenshot request from main window
     */
    ipcMain.on('area-screenshot', () => {
      logger.info('Area screenshot requested from main window');
      this.startSelection();
    });

    /**
     * Handle fullscreen screenshot request from main window
     */
    ipcMain.on('fullscreen-screenshot', () => {
      logger.info('Fullscreen screenshot requested from main window');
      this.captureFullScreen();
    });

    /**
     * Handle save screenshot request from preview window
     */
    ipcMain.on('save-screenshot', (event, data) => {
      this._handleSaveScreenshot(event, data);
    });

    /**
     * Handle get screenshots request from gallery
     */
    ipcMain.on('get-screenshots', (event) => {
      event.reply('screenshots-list', this.storage.getAllScreenshots());
    });

    /**
     * Handle delete screenshot request
     */
    ipcMain.on('delete-screenshot', (event, id) => {
      const deleted = this.storage.deleteScreenshot(id);
      if (deleted) {
        event.reply('screenshot-deleted', id);
      }
    });

    /**
     * Handle copy file to clipboard request
     */
    ipcMain.on('copy-file-to-clipboard', (event, filePath) => {
      try {
        const image = toNativeImage(this.storage.readFile(filePath));
        clipboard.writeImage(image);
        event.reply('copy-complete');
      } catch (error) {
        logger.error('Error copying file to clipboard:', error);
      }
    });

    /**
     * Handle open preview request from gallery
     */
    ipcMain.on('open-preview', (event, filePath) => {
      this._handleOpenPreview(filePath);
    });

    /**
     * Handle new screenshot request from preview window
     */
    ipcMain.on('new-screenshot-request', () => {
      logger.info('New screenshot requested from preview window');
      // Close preview window first, then start selection
      BrowserWindow.getFocusedWindow()?.close();
      setTimeout(() => {
        this.startSelection();
      }, 100);
    });

    /**
     * Handle open gallery request from preview window
     */
    ipcMain.on('open-gallery-from-preview', () => {
      logger.info('Gallery requested from preview window');
      // Close preview window first, then open gallery
      BrowserWindow.getFocusedWindow()?.close();
      setTimeout(() => {
        this.windowManager.createGalleryWindow();
      }, 100);
    });

    /**
     * Handle get virtual screen bounds request
     * Returns the bounding box of all displays for multi-monitor fullscreen capture
     */
    ipcMain.on('get-virtual-screen-bounds', (event) => {
      const virtualBounds = this.capture.getVirtualScreenBounds();
      event.reply('virtual-screen-bounds', virtualBounds);
    });

    /**
     * Handle selection sync start - broadcast mouse down to all selection windows
     */
    ipcMain.on('selection-sync-start', (event, data) => {
      const selectionWindows = this.windowManager.getSelectionWindow();
      if (Array.isArray(selectionWindows)) {
        selectionWindows.forEach(win => {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('selection-synced-start', data);
          }
        });
      }
    });

    /**
     * Handle selection sync move - broadcast mouse move to all selection windows
     */
    ipcMain.on('selection-sync-move', (event, data) => {
      const selectionWindows = this.windowManager.getSelectionWindow();
      if (Array.isArray(selectionWindows)) {
        selectionWindows.forEach(win => {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('selection-synced-move', data);
          }
        });
      }
    });

    /**
     * Handle selection sync end - broadcast mouse up to all selection windows
     */
    ipcMain.on('selection-sync-end', (event, data) => {
      const selectionWindows = this.windowManager.getSelectionWindow();
      if (Array.isArray(selectionWindows)) {
        selectionWindows.forEach(win => {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('selection-synced-end', data);
          }
        });
      }
    });

    /**
     * Handle selection sync cancel - broadcast cancel to all selection windows
     */
    ipcMain.on('selection-sync-cancel', () => {
      const selectionWindows = this.windowManager.getSelectionWindow();
      if (Array.isArray(selectionWindows)) {
        selectionWindows.forEach(win => {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('selection-synced-cancel');
          }
        });
      }
    });
  }

  /**
   * Handle save screenshot IPC request
   *
   * @param {Object} event - IPC event object
   * @param {Object} data - Image data and bounds
   * @private
   */
  _handleSaveScreenshot(event, data) {
    try {
      logger.info('Saving screenshot...');

      const screenshot = this.storage.saveScreenshot(
        data.imageData,
        data.filename
      );

      // Notify gallery if open
      const galleryWindow = this.windowManager.getGalleryWindow();
      if (galleryWindow) {
        galleryWindow.webContents.send('screenshot-added', screenshot);
      }

      event.reply('save-complete', {
        filePath: screenshot.filePath,
        id: screenshot.id
      });

      logger.info('Screenshot saved successfully:', screenshot.filePath);

    } catch (error) {
      logger.error('Error saving screenshot:', error);
      event.reply('save-error', { error: error.message });
    }
  }

  /**
   * Handle open preview request from gallery
   *
   * @param {string} filePath - Path to the screenshot file
   * @private
   */
  _handleOpenPreview(filePath) {
    try {
      const imageBuffer = this.storage.readFile(filePath);
      const image = toNativeImage(imageBuffer);
      const size = image.getSize();

      this.windowManager.createPreviewWindow(
        image.toPNG(),
        { x: 0, y: 0, width: size.width, height: size.height },
        filePath
      );

    } catch (error) {
      logger.error('Error opening preview:', error);
    }
  }

  /**
   * Initialize the application when Electron is ready
   */
  async whenReady() {
    logger.start('whenReady');

    // Create system tray (app starts minimized to tray, no window shown)
    this.trayManager.create();

    // Register keyboard shortcuts
    this._registerShortcuts();

    logger.success('whenReady');
  }

  /**
   * Register global keyboard shortcuts
   *
   * @private
   */
  _registerShortcuts() {
    logger.info('Registering global shortcuts...');

    const shortcuts = [
      {
        accelerator: 'CommandOrControl+Shift+A',
        name: 'Area selection',
        callback: () => {
          logger.info('Area selection shortcut triggered');
          // Close preview window if open
          const previewWindow = this.windowManager.getPreviewWindow();
          if (previewWindow && !previewWindow.isDestroyed()) {
            previewWindow.close();
            setTimeout(() => {
              this.startSelection();
            }, 100);
          } else {
            this.startSelection();
          }
        }
      },
      {
        accelerator: 'CommandOrControl+Shift+F',
        name: 'Full screen',
        callback: () => {
          logger.info('Full screen shortcut triggered');
          // Close preview window if open
          const previewWindow = this.windowManager.getPreviewWindow();
          if (previewWindow && !previewWindow.isDestroyed()) {
            previewWindow.close();
            setTimeout(() => {
              this.captureFullScreen();
            }, 100);
          } else {
            this.captureFullScreen();
          }
        }
      },
      {
        accelerator: 'CommandOrControl+Shift+G',
        name: 'Gallery',
        callback: () => {
          logger.info('Gallery shortcut triggered');
          // Close preview window if open
          const previewWindow = this.windowManager.getPreviewWindow();
          if (previewWindow && !previewWindow.isDestroyed()) {
            previewWindow.close();
            setTimeout(() => {
              this.windowManager.createGalleryWindow();
            }, 100);
          } else {
            this.windowManager.createGalleryWindow();
          }
        }
      }
    ];

    const result = this.shortcuts.registerAll(shortcuts);

    if (result.successful === 0) {
      logger.warn('No shortcuts registered - app will work via tray menu only');
    }
  }

  /**
   * Start area selection mode
   * Creates a full-screen window for the user to select an area
   */
  startSelection() {
    logger.start('startSelection');
    this.windowManager.createSelectionWindow();
  }

  /**
   * Capture the full screen
   * Captures the primary display and opens preview window
   */
  async captureFullScreen() {
    logger.start('captureFullScreen');

    try {
      const result = await this.capture.captureFullScreen();
      this.windowManager.createPreviewWindow(result.image, result.bounds);
      logger.success('captureFullScreen');

    } catch (error) {
      logger.error('Error capturing full screen:', error);
    }
  }

  /**
   * Quit the application
   * Cleans up resources before exiting
   */
  quit() {
    logger.info('Quitting application...');
    this.isQuitting = true;

    // Signal to window manager
    this.windowManager.setQuitting();

    // Unregister shortcuts
    this.shortcuts.unregisterAll();

    // Destroy tray
    this.trayManager.destroy();

    // Quit the app
    app.quit();
  }

  /**
   * Handle window-all-closed event
   * Prevents app from quitting when all windows are closed (keeps running in tray)
   */
  onWindowAllClosed(event) {
    event.preventDefault();
    logger.info('All windows closed - keeping app running in tray');
  }

  /**
   * Handle before-quit event
   * Cleanup before app exits
   */
  onBeforeQuit() {
    logger.info('Before quit - cleaning up');
    this.shortcuts.unregisterAll();
  }

  /**
   * Create a delay promise
   *
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Application Entry Point
// ============================================================================

// Create the application instance
let screenshotApp = null;

// Wait for Electron to be ready
app.whenReady().then(() => {
  screenshotApp = new ScreenshotApplication();
  screenshotApp.whenReady();
});

// Handle window-all-closed event
app.on('window-all-closed', (event) => {
  if (screenshotApp) {
    screenshotApp.onWindowAllClosed(event);
  }
});

// Handle before-quit event
app.on('before-quit', () => {
  if (screenshotApp) {
    screenshotApp.onBeforeQuit();
  }
});

// Handle will-quit event (backup cleanup)
app.on('will-quit', (event) => {
  // Prevent default to handle cleanup ourselves
  event.preventDefault();

  if (screenshotApp) {
    screenshotApp.shortcuts.unregisterAll();
  }

  // Actually quit after cleanup
  app.exit(0);
});
