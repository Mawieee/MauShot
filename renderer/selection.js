/**
 * selection.js - Selection window renderer script
 *
 * Handles the area selection UI for screenshot capture.
 * Provides visual feedback during mouse drag and sends
 * the final selection coordinates to the main process.
 *
 * Supports multi-monitor selections by synchronizing mouse events
 * across multiple selection windows.
 */

const { ipcRenderer, screen } = require('electron');

/**
 * SelectionController - Manages the area selection interaction
 */
class SelectionController {
  /**
   * Initialize the selection controller
   */
  constructor() {
    // State
    this.isSelecting = false;
    this.isCoordinator = false;
    this.startX = 0;
    this.startY = 0;

    // Multi-monitor state
    this.displayIndex = 0;
    this.totalDisplays = 1;
    this.displayBounds = { x: 0, y: 0, width: 0, height: 0 };
    this.virtualBounds = { x: 0, y: 0, width: 0, height: 0 };
    this.allDisplays = [];

    // Selection state (shared across windows)
    this.selectionBounds = { x: 0, y: 0, width: 0, height: 0 };

    // DOM elements
    this.selectionBox = document.getElementById('selection-box');
    this.dimensions = document.getElementById('dimensions');
    this.infoPanel = document.getElementById('info-panel');

    // Bind methods
    this._setupEventListeners();
    this._setupIpcListeners();

    console.log('Selection controller initialized');
  }

  /**
   * Set up all event listeners for selection interaction
   *
   * @private
   */
  _setupEventListeners() {
    // Use pointer events for better cross-monitor support
    // Pointer events work more reliably across different displays
    document.addEventListener('pointerdown', this._handleMouseDown.bind(this));
    document.addEventListener('pointermove', this._handleMouseMove.bind(this));
    document.addEventListener('pointerup', this._handleMouseUp.bind(this));

    // Also keep mouse events as fallback
    document.addEventListener('mousedown', this._handleMouseDown.bind(this));
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));

    // Keyboard shortcuts
    document.addEventListener('keydown', this._handleKeyDown.bind(this));

    // Right-click to cancel
    document.addEventListener('contextmenu', this._handleContextMenu.bind(this));

    // Fullscreen button
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
      this._sendFullScreenSelection();
    });
  }

  /**
   * Set up IPC listeners for multi-window synchronization
   *
   * @private
   */
  _setupIpcListeners() {
    // Receive display info from main process
    ipcRenderer.on('init-display-info', (event, info) => {
      console.log('Received display info:', info);
      this.displayIndex = info.displayIndex;
      this.totalDisplays = info.totalDisplays;
      this.displayBounds = info.displayBounds;
      this.virtualBounds = info.virtualBounds;
      this.allDisplays = info.allDisplays;

      // First window is the coordinator
      this.isCoordinator = this.displayIndex === 0;

      console.log(`Display ${this.displayIndex}/${this.totalDisplays}, Coordinator: ${this.isCoordinator}`);

      // Adjust window position to match display bounds
      this._adjustWindowPosition();
    });

    // Receive synchronized mouse down from coordinator
    ipcRenderer.on('selection-synced-start', (event, data) => {
      console.log(`Window ${this.displayIndex}: Received sync start`, data);
      this.isSelecting = true;
      this.startX = data.startX;
      this.startY = data.startY;

      // Show visual elements
      this.selectionBox.style.display = 'block';
      this.dimensions.style.display = 'block';

      // Update to initial point
      this._updateSelectionBox(data.x, data.y, data.width, data.height);
      this.infoPanel.textContent = 'Drag to select area';
    });

    // Receive synchronized mouse move from coordinator
    ipcRenderer.on('selection-synced-move', (event, data) => {
      if (!this.isSelecting) {
        return;
      }
      this._updateSelectionBox(data.x, data.y, data.width, data.height);
    });

    // Receive synchronized mouse up from coordinator
    ipcRenderer.on('selection-synced-end', (event, data) => {
      console.log(`Window ${this.displayIndex}: Received sync end`);
      this.isSelecting = false;

      // Only coordinator sends final selection
      if (this.isCoordinator) {
        this._sendSelection(data.x, data.y, data.width, data.height);
      } else {
        // Hide visual elements
        this.selectionBox.style.display = 'none';
        this.dimensions.style.display = 'none';
      }
    });

    // Receive synchronized cancel from coordinator
    ipcRenderer.on('selection-synced-cancel', () => {
      console.log(`Window ${this.displayIndex}: Received sync cancel`);
      this.cancel(false); // Don't broadcast again
    });
  }

  /**
   * Adjust window position to match display bounds
   *
   * @private
   */
  _adjustWindowPosition() {
    // The window is already positioned by main process, but we need to
    // ensure our coordinate system is correct
    console.log('Window position:', {
      displayBounds: this.displayBounds,
      virtualBounds: this.virtualBounds
    });
  }

  /**
   * Handle mouse down - start selection
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseDown(event) {
    // Ignore clicks on controls
    if (event.target.closest('.controls') || event.target.closest('button')) {
      return;
    }

    console.log('Selection started at:', event.screenX, event.screenY);
    this._logDebug('Mousedown at: ' + event.screenX + ', ' + event.screenY);

    // Start selection
    this.isSelecting = true;
    this.startX = event.screenX;
    this.startY = event.screenY;

    // Show visual elements
    this.selectionBox.style.display = 'block';
    this.dimensions.style.display = 'block';

    // Update to initial point
    this._updateSelectionBox(this.startX, this.startY, 0, 0);

    // Update info text
    this.infoPanel.textContent = 'Drag to select area';

    // Broadcast to all other windows
    if (this.totalDisplays > 1) {
      ipcRenderer.send('selection-sync-start', {
        startX: this.startX,
        startY: this.startY,
        x: this.startX,
        y: this.startY,
        width: 0,
        height: 0
      });
    }
  }

  /**
   * Handle mouse move - update selection area
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseMove(event) {
    if (!this.isSelecting) {
      return;
    }

    // Calculate selection bounds
    const currentX = event.screenX;
    const currentY = event.screenY;

    const x = Math.min(this.startX, currentX);
    const y = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    // Update visual
    this._updateSelectionBox(x, y, width, height);

    // Broadcast to all other windows
    if (this.totalDisplays > 1) {
      ipcRenderer.send('selection-sync-move', { x, y, width, height });
    }
  }

  /**
   * Handle mouse up - complete selection
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseUp(event) {
    if (!this.isSelecting) {
      return;
    }

    const endX = event.screenX;
    const endY = event.screenY;

    // Calculate final selection bounds
    const x = Math.min(this.startX, endX);
    const y = Math.min(this.startY, endY);
    const width = Math.abs(endX - this.startX);
    const height = Math.abs(endY - this.startY);

    console.log('Selection complete:', { x, y, width, height });
    this._logDebug('Selection bounds: ' + width + 'x' + height);

    // Broadcast to all other windows
    if (this.totalDisplays > 1) {
      ipcRenderer.send('selection-sync-end', { x, y, width, height });
    }

    // Check minimum size (require at least 10x10 pixels)
    if (width > 10 && height > 10) {
      // Only coordinator sends final selection
      if (this.isCoordinator) {
        this._sendSelection(x, y, width, height);
      }
      this.isSelecting = false;
    } else {
      console.log('Selection too small, cancelling');
      this._logDebug('Selection too small: ' + width + 'x' + height);
      this.cancel();
    }
  }

  /**
   * Handle keyboard shortcuts
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleKeyDown(event) {
    if (event.key === 'Escape') {
      // Cancel selection
      this.cancel();
    } else if (event.key === 'Enter') {
      // Confirm current selection
      if (this.selectionBox.style.display === 'block') {
        const rect = this.selectionBox.getBoundingClientRect();
        this._sendSelection(rect.left, rect.top, rect.width, rect.height);
      }
    }
  }

  /**
   * Handle right-click - cancel selection
   *
   * @param {MouseEvent} event - Context menu event
   * @private
   */
  _handleContextMenu(event) {
    event.preventDefault();
    this.cancel();
  }

  /**
   * Update the visual selection box
   *
   * @param {number} x - X position (virtual screen coordinates)
   * @param {number} y - Y position (virtual screen coordinates)
   * @param {number} width - Width
   * @param {number} height - Height
   * @private
   */
  _updateSelectionBox(x, y, width, height) {
    // Convert virtual screen coordinates to window-relative coordinates
    // The window is positioned at this.displayBounds.x, this.displayBounds.y
    const windowX = x - this.displayBounds.x;
    const windowY = y - this.displayBounds.y;

    // Calculate intersection with this window
    const windowRight = this.displayBounds.width;
    const windowBottom = this.displayBounds.height;
    const selectionRight = windowX + width;
    const selectionBottom = windowY + height;

    // Check if selection intersects with this window
    const intersects = !(
      selectionRight <= 0 ||
      windowX >= windowRight ||
      selectionBottom <= 0 ||
      windowY >= windowBottom
    );

    if (!intersects && width > 0 && height > 0) {
      // Selection doesn't intersect with this window, hide it
      this.selectionBox.style.display = 'none';
      return;
    }

    // Calculate the visible portion within this window
    // Clip the selection to window boundaries
    const visibleX = Math.max(0, windowX);
    const visibleY = Math.max(0, windowY);
    const visibleRight = Math.min(selectionRight, windowRight);
    const visibleBottom = Math.min(selectionBottom, windowBottom);

    const visibleWidth = Math.max(0, visibleRight - visibleX);
    const visibleHeight = Math.max(0, visibleBottom - visibleY);

    if (visibleWidth <= 0 || visibleHeight <= 0) {
      this.selectionBox.style.display = 'none';
      return;
    }

    // Show and position the selection box
    this.selectionBox.style.display = 'block';
    this.selectionBox.style.left = visibleX + 'px';
    this.selectionBox.style.top = visibleY + 'px';
    this.selectionBox.style.width = visibleWidth + 'px';
    this.selectionBox.style.height = visibleHeight + 'px';

    // Update dimensions display (only show on coordinator window)
    if (this.isCoordinator) {
      this.dimensions.style.display = 'block';
      const dimensionsText = `${Math.round(width)} × ${Math.round(height)}`;
      this.dimensions.textContent = dimensionsText;

      // Position dimensions near the cursor end of selection (clamped to window)
      const dimX = Math.max(10, Math.min(selectionRight + 10, windowRight - 100));
      const dimY = Math.max(10, Math.min(selectionBottom + 10, windowBottom - 30));
      this.dimensions.style.left = dimX + 'px';
      this.dimensions.style.top = dimY + 'px';

      // Update info panel with accessible text
      this.infoPanel.textContent = `Selection: ${dimensionsText} pixels`;

      // Announce selection size to screen readers
      if (window.announceToScreenReader && width > 0 && height > 0) {
        window.announceToScreenReader(`Selecting area ${Math.round(width)} by ${Math.round(height)} pixels`);
      }
    } else {
      this.dimensions.style.display = 'none';
    }
  }

  /**
   * Send the selection to the main process
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} width - Width
   * @param {number} height - Height
   * @private
   */
  _sendSelection(x, y, width, height) {
    this.infoPanel.textContent = 'Capturing...';

    // Announce capture start
    if (window.announceToScreenReader) {
      window.announceToScreenReader('Capturing selected area...');
    }

    const payload = {
      bounds: { x, y, width, height },
      absoluteCoords: true  // Using absolute screen coordinates
    };

    console.log('Sending selection:', payload);
    this._logDebug('Sending selection: ' + JSON.stringify(payload));

    ipcRenderer.send('selection-complete', payload);
  }

  /**
   * Send fullscreen selection to main process
   *
   * Captures all monitors by requesting the virtual screen bounds.
   *
   * @private
   */
  _sendFullScreenSelection() {
    this._logDebug('Fullscreen button clicked');

    // Request virtual screen bounds from main process for multi-monitor support
    ipcRenderer.send('get-virtual-screen-bounds');

    // Listen for the response with actual virtual screen bounds
    ipcRenderer.once('virtual-screen-bounds', (event, bounds) => {
      const payload = {
        bounds: bounds,
        absoluteCoords: true
      };

      this._logDebug('Sending fullscreen selection with bounds:', payload);
      ipcRenderer.send('selection-complete', payload);
    });
  }

  /**
   * Cancel the current selection
   *
   * @param {boolean} [broadcast=true] - Whether to broadcast cancel to other windows
   */
  cancel(broadcast = true) {
    this.isSelecting = false;
    this.selectionBox.style.display = 'none';
    this.dimensions.style.display = 'none';

    // Announce cancellation
    if (window.announceToScreenReader) {
      window.announceToScreenReader('Selection cancelled');
    }

    // Broadcast to all other windows
    if (broadcast && this.totalDisplays > 1) {
      ipcRenderer.send('selection-sync-cancel');
    }

    ipcRenderer.send('selection-cancelled');
  }

  /**
   * Send a debug log to the main process
   *
   * @param {string} message - Debug message
   * @private
   */
  _logDebug(message) {
    ipcRenderer.send('debug-log', message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Selection window loaded');
  window.selectionController = new SelectionController();
});
