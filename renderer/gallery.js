/**
 * gallery.js - Gallery window renderer script
 *
 * Manages the screenshot gallery display with a mobile-style interface.
 * Features search, sort, delete, and navigation functionality.
 */

const { ipcRenderer, shell } = require('electron');

/**
 * FocusTrap - Utility class for trapping focus within a DOM element
 */
class FocusTrap {
  /**
   * Create a new focus trap
   * @param {HTMLElement} element - The element to trap focus within
   */
  constructor(element) {
    this.element = element;
    this.focusableElements = null;
    this.firstFocusable = null;
    this.lastFocusable = null;
    this.previousActiveElement = null;
    this.boundKeyDownHandler = null;
  }

  /**
   * Activate the focus trap
   */
  activate() {
    // Store the previously focused element
    this.previousActiveElement = document.activeElement;

    // Get all focusable elements
    this.focusableElements = this.element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), ' +
      'input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    // Convert NodeList to Array for easier manipulation
    this.focusableElements = Array.from(this.focusableElements);

    // Filter out elements that are hidden or within hidden parents
    this.focusableElements = this.focusableElements.filter(el => {
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });

    if (this.focusableElements.length === 0) {
      return;
    }

    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];

    // Focus the first focusable element
    this.firstFocusable.focus();

    // Bind keydown handler for Tab key
    this.boundKeyDownHandler = this._handleKeyDown.bind(this);
    this.element.addEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Deactivate the focus trap and return focus to previous element
   */
  deactivate() {
    if (this.boundKeyDownHandler) {
      this.element.removeEventListener('keydown', this.boundKeyDownHandler);
      this.boundKeyDownHandler = null;
    }

    // Return focus to the previously focused element
    if (this.previousActiveElement && this.previousActiveElement.focus) {
      this.previousActiveElement.focus();
    }
  }

  /**
   * Handle keyboard events for focus trapping
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleKeyDown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    // Shift + Tab
    if (event.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault();
        this.lastFocusable.focus();
      }
    }
    // Tab
    else {
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }
}

/**
 * GalleryController - Manages the screenshot gallery UI with mobile-style navigation
 */
class GalleryController {
  /**
   * Initialize the gallery controller
   */
  constructor() {
    // State
    this.screenshots = [];
    this.filteredScreenshots = [];
    this.currentPreviewId = null;
    this.deleteTargetId = null;
    this.currentView = 'home';

    // DOM elements
    this.galleryGrid = document.getElementById('gallery-grid');
    this.emptyState = document.getElementById('empty-state');
    this.previewModal = document.getElementById('preview-modal');
    this.confirmModal = document.getElementById('confirm-modal');
    this.toast = document.getElementById('toast');
    this.bottomNav = document.getElementById('bottom-nav');
    this.appHeader = document.querySelector('.app-header h1');
    this.contextMenu = document.getElementById('context-menu');
    this.contextMenuTargetId = null;

    // Focus trap instances for modals
    this.previewFocusTrap = new FocusTrap(this.previewModal);
    this.confirmFocusTrap = new FocusTrap(this.confirmModal);

    // Bind methods
    this._setupIpcListeners();
    this._setupEventListeners();

    // Load initial data
    this.loadScreenshots();

    console.log('Gallery controller initialized with mobile-style UI');
  }

  /**
   * Set up IPC listeners for main process messages
   *
   * @private
   */
  _setupIpcListeners() {
    /**
     * Receive screenshots list
     */
    ipcRenderer.on('screenshots-list', (event, list) => {
      this.screenshots = list;
      this.applyFiltersAndSort();
    });

    /**
     * New screenshot added
     */
    ipcRenderer.on('screenshot-added', (event, screenshot) => {
      this.screenshots.unshift(screenshot);
      this.applyFiltersAndSort();
      this.showToast('Screenshot saved!');

      // Automatically open preview for the new screenshot
      this.currentPreviewId = screenshot.id;
      document.getElementById('preview-image').src = screenshot.filePath;
      this.previewModal.classList.add('active');
      this.previewModal.setAttribute('aria-hidden', 'false');
      // Activate focus trap
      this.previewFocusTrap.activate();
    });

    /**
     * Screenshot deleted
     */
    ipcRenderer.on('screenshot-deleted', (event, id) => {
      this.screenshots = this.screenshots.filter(s => s.id !== id);
      this.applyFiltersAndSort();
      this.showToast('Screenshot deleted');
    });

    /**
     * Copy complete notification
     */
    ipcRenderer.on('copy-complete', () => {
      this.showToast('Copied to clipboard!');
    });
  }

  /**
   * Set up DOM event listeners
   *
   * @private
   */
  _setupEventListeners() {
    // Floating Action Button (FAB) - New screenshot
    document.getElementById('fab-new-screenshot').addEventListener('click', () => {
      this.startNewScreenshot();
    });

    // Bottom Navigation
    this.bottomNav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        this.switchView(item.dataset.view, item.dataset.title);
      });
    });

    // Preview modal close button
    document.getElementById('preview-close').addEventListener('click', () => {
      this.closePreview();
    });

    this.previewModal.addEventListener('click', (e) => {
      if (e.target === this.previewModal) {
        this.closePreview();
      }
    });

    // Preview action buttons
    document.getElementById('preview-copy-btn').addEventListener('click', () => {
      if (this.currentPreviewId) {
        this.copyScreenshot(this.currentPreviewId);
      }
    });

    document.getElementById('preview-open-btn').addEventListener('click', () => {
      if (this.currentPreviewId) {
        this.openPreviewInEditor(this.currentPreviewId);
      }
    });

    document.getElementById('preview-share-btn').addEventListener('click', () => {
      if (this.currentPreviewId) {
        this.shareScreenshot(this.currentPreviewId);
      }
    });

    document.getElementById('preview-delete-btn').addEventListener('click', () => {
      if (this.currentPreviewId) {
        this.confirmDeleteScreenshot(this.currentPreviewId);
      }
    });

    // Delete confirmation modal
    document.getElementById('confirm-cancel').addEventListener('click', () => {
      this.closeConfirmModal();
    });

    document.getElementById('confirm-delete').addEventListener('click', () => {
      if (this.deleteTargetId) {
        this.deleteScreenshot(this.deleteTargetId);
      }
    });

    this.confirmModal.addEventListener('click', (e) => {
      if (e.target === this.confirmModal) {
        this.closeConfirmModal();
      }
    });

    // Context menu item clicks
    this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const id = this.contextMenuTargetId;

        if (id) {
          if (action === 'open-location') {
            this.openFileLocation(id);
          } else if (action === 'copy') {
            this.copyScreenshot(id);
          } else if (action === 'delete') {
            this.confirmDeleteScreenshot(id);
          }
        }

        this.hideContextMenu();
      });
    });

    // Hide context menu on click outside
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.confirmModal.classList.contains('active')) {
          this.closeConfirmModal();
        } else if (this.previewModal.classList.contains('active')) {
          this.closePreview();
        }
      } else if (e.key === 'Delete' && this.currentPreviewId && this.previewModal.classList.contains('active')) {
        this.confirmDeleteScreenshot(this.currentPreviewId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.startNewScreenshot();
      }
    });
  }

  /**
   * Load screenshots from main process
   */
  loadScreenshots() {
    ipcRenderer.send('get-screenshots');
  }

  /**
   * Apply search filter and sorting to screenshots
   */
  applyFiltersAndSort() {
    // For now, show all screenshots sorted by date (newest first)
    this.filteredScreenshots = [...this.screenshots].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    this.renderGallery();
  }

  /**
   * Render the screenshot gallery
   */
  renderGallery() {
    // Handle empty state
    if (this.filteredScreenshots.length === 0) {
      this.galleryGrid.style.display = 'none';
      this.emptyState.style.display = 'block';
      return;
    }

    // Show grid
    this.galleryGrid.style.display = 'grid';
    this.emptyState.style.display = 'none';

    // Render screenshot cards
    this.galleryGrid.innerHTML = this.filteredScreenshots.map(screenshot => `
      <div class="screenshot-card" data-id="${screenshot.id}">
        <div class="thumbnail-container">
          <img class="thumbnail" src="${screenshot.thumbnailPath}" alt="${screenshot.name}">
          <div class="card-actions">
            <button class="quick-action-btn" data-action="copy" data-id="${screenshot.id}" title="Copy to clipboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
            <button class="quick-action-btn delete" data-action="delete" data-id="${screenshot.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-info">
          <div class="card-name">${this._escapeHtml(screenshot.name)}</div>
          <div class="card-date">${this._formatDate(screenshot.createdAt)}</div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    this._attachItemClickHandlers();
  }

  /**
   * Attach click handlers to screenshot cards
   *
   * @private
   */
  _attachItemClickHandlers() {
    // Card clicks (open preview)
    this.galleryGrid.querySelectorAll('.screenshot-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Ignore if clicking action buttons
        if (e.target.closest('.quick-action-btn')) {
          return;
        }
        this.openPreview(card.dataset.id);
      });

      // Right-click context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, card.dataset.id);
      });
    });

    // Action button clicks
    this.galleryGrid.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'copy') {
          this.copyScreenshot(id);
        } else if (action === 'delete') {
          this.confirmDeleteScreenshot(id);
        }
      });
    });
  }

  /**
   * Format a date string for display
   *
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date string
   * @private
   */
  _formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Switch between different views (Home, Gallery, Favorites, Settings)
   *
   * @param {string} viewName - The view to switch to
   * @param {string} title - The title to display
   */
  switchView(viewName, title) {
    // Update active nav item
    this.bottomNav.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Update header title
    if (title && this.appHeader) {
      this.appHeader.textContent = title;
    }

    // Handle view-specific logic
    this.currentView = viewName;

    switch (viewName) {
      case 'home':
      case 'gallery':
        // Show all screenshots
        this.filteredScreenshots = [...this.screenshots].sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        this.renderGallery();
        break;
      case 'favorites':
        // Filter to show only favorites (placeholder for future feature)
        this.filteredScreenshots = [];
        this.showToast('Favorites feature coming soon!');
        this.renderGallery();
        break;
      case 'settings':
        // Show settings view (placeholder for future feature)
        this.showToast('Settings feature coming soon!');
        break;
    }
  }

  /**
   * Start a new screenshot (via area selection)
   */
  startNewScreenshot() {
    ipcRenderer.send('area-screenshot');
    this.showToast('Select an area to capture');
  }

  /**
   * Copy a screenshot to clipboard
   *
   * @param {string} id - Screenshot ID
   */
  copyScreenshot(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      ipcRenderer.send('copy-file-to-clipboard', screenshot.filePath);
    }
  }

  /**
   * Share a screenshot (placeholder for future sharing functionality)
   *
   * @param {string} id - Screenshot ID
   */
  shareScreenshot(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      // For now, just show a toast - sharing can be extended later
      this.showToast('Share feature coming soon!');
    }
  }

  /**
   * Confirm delete screenshot
   *
   * @param {string} id - Screenshot ID
   */
  confirmDeleteScreenshot(id) {
    this.deleteTargetId = id;
    this.confirmModal.classList.add('active');
    this.confirmModal.setAttribute('aria-hidden', 'false');
    // Activate focus trap
    this.confirmFocusTrap.activate();
  }

  /**
   * Delete a screenshot
   *
   * @param {string} id - Screenshot ID
   */
  deleteScreenshot(id) {
    ipcRenderer.send('delete-screenshot', id);
    this.closeConfirmModal();

    if (this.currentPreviewId === id) {
      this.closePreview();
    }
  }

  /**
   * Close the delete confirmation modal
   */
  closeConfirmModal() {
    this.confirmModal.classList.remove('active');
    this.confirmModal.setAttribute('aria-hidden', 'true');
    this.deleteTargetId = null;
    // Deactivate focus trap
    this.confirmFocusTrap.deactivate();
  }

  /**
   * Open preview for a screenshot
   *
   * @param {string} id - Screenshot ID
   */
  openPreview(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      this.currentPreviewId = id;
      document.getElementById('preview-image').src = screenshot.filePath;
      this.previewModal.classList.add('active');
      this.previewModal.setAttribute('aria-hidden', 'false');
      // Activate focus trap
      this.previewFocusTrap.activate();

      // Announce preview opening
      const liveRegion = document.getElementById('a11y-live-region');
      if (liveRegion) {
        liveRegion.textContent = `Previewing screenshot: ${screenshot.name}`;
      }
    }
  }

  /**
   * Open screenshot in the preview editor
   *
   * @param {string} id - Screenshot ID
   */
  openPreviewInEditor(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      ipcRenderer.send('open-preview', screenshot.filePath);
      this.closePreview();
    }
  }

  /**
   * Close the preview modal
   */
  closePreview() {
    this.previewModal.classList.remove('active');
    this.previewModal.setAttribute('aria-hidden', 'true');
    this.currentPreviewId = null;
    // Deactivate focus trap
    this.previewFocusTrap.deactivate();
  }

  /**
   * Show the context menu at the cursor position
   *
   * @param {MouseEvent} e - The contextmenu event
   * @param {string} id - Screenshot ID
   */
  showContextMenu(e, id) {
    this.contextMenuTargetId = id;

    // Position the context menu
    let x = e.clientX;
    let y = e.clientY;

    // Ensure menu doesn't go off-screen
    const menuWidth = 180;
    const menuHeight = 120;
    const padding = 8;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.add('active');
  }

  /**
   * Hide the context menu
   */
  hideContextMenu() {
    this.contextMenu.classList.remove('active');
    this.contextMenuTargetId = null;
  }

  /**
   * Open the file location in the system file manager
   *
   * @param {string} id - Screenshot ID
   */
  openFileLocation(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      shell.showItemInFolder(screenshot.filePath);
    }
  }

  /**
   * Show a toast notification
   *
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds (default: 2000)
   */
  showToast(message, duration = 2000) {
    this.toast.textContent = message;
    this.toast.classList.add('show');

    // Announce to accessibility live region
    const liveRegion = document.getElementById('a11y-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
    }

    // Clear any existing timeout
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    // Hide after duration
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
      // Clear live region after toast is hidden
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, duration);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Gallery window loaded');
  window.galleryController = new GalleryController();
});
