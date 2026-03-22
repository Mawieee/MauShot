/**
 * Accessibility fixes module for MauShot
 *
 * This module contains accessibility improvements and utilities
 * that can be applied across all windows.
 */

class AccessibilityManager {
  /**
   * Initialize accessibility improvements
   */
  static initialize() {
    this._setupFocusIndicators();
    this._setupLiveRegions();
    this._announceToScreenReader('MauShot application loaded');
  }

  /**
   * Setup visible focus indicators for all interactive elements
   * @private
   */
  static _setupFocusIndicators() {
    // Add focus-visible polyfill behavior
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('user-is-tabbing');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('user-is-tabbing');
    });

    // Ensure all buttons have visible focus styles
    const style = document.createElement('style');
    style.textContent = `
      /* Improved focus indicators for keyboard navigation */
      body.user-is-tabbing button:focus,
      body.user-is-tabbing a:focus,
      body.user-is-tabbing input:focus,
      body.user-is-tabbing select:focus,
      body.user-is-tabbing textarea:focus,
      body.user-is-tabbing [tabindex]:focus {
        outline: 2px solid #0078d4 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(0, 120, 212, 0.3) !important;
      }

      /* High contrast focus for better visibility */
      @media (prefers-contrast: high) {
        button:focus,
        a:focus,
        input:focus,
        select:focus {
          outline: 3px solid #0078d4 !important;
          outline-offset: 2px !important;
        }
      }

      /* Ensure focus indicators are visible in all color schemes */
      @media (prefers-color-scheme: dark) {
        button:focus,
        a:focus,
        input:focus,
        select:focus {
          outline-color: #4fc3f7 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup ARIA live regions for dynamic content announcements
   * @private
   */
  static _setupLiveRegions() {
    // Create live region if it doesn't exist
    if (!document.getElementById('accessibility-live-region')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'accessibility-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'visually-hidden';
      document.body.appendChild(liveRegion);
    }
  }

  /**
   * Announce a message to screen readers
   * @param {string} message - The message to announce
   */
  static announceToScreenReader(message) {
    this._setupLiveRegions();
    const liveRegion = document.getElementById('accessibility-live-region');
    if (liveRegion) {
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 100);
    }
  }

  /**
   * Ensure an image has proper alt text
   * @param {HTMLImageElement} img - The image element
   * @param {string} altText - The alt text to set
   */
  static ensureImageAltText(img, altText) {
    if (!img.hasAttribute('alt')) {
      img.setAttribute('alt', altText || '');
    }
  }

  /**
   * Add proper labels to form controls
   * @param {HTMLElement} control - The form control element
   * @param {string} label - The label text
   */
  static labelFormControl(control, label) {
    if (!control.getAttribute('aria-label') &&
        !control.getAttribute('aria-labelledby')) {
      control.setAttribute('aria-label', label);
    }
  }

  /**
   * Trap focus within a container (for modals)
   * @param {HTMLElement} container - The container element
   * @returns {Object} Focus trap object with activate/deactivate methods
   */
  static createFocusTrap(container) {
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), ' +
      'input[type="checkbox"]:not([disabled]), select:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    let previousActiveElement = null;

    const trapFocus = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    return {
      activate: () => {
        previousActiveElement = document.activeElement;
        if (firstFocusable) firstFocusable.focus();
        container.addEventListener('keydown', trapFocus);
        container.setAttribute('aria-hidden', 'false');
      },
      deactivate: () => {
        container.removeEventListener('keydown', trapFocus);
        container.setAttribute('aria-hidden', 'true');
        if (previousActiveElement && previousActiveElement.focus) {
          previousActiveElement.focus();
        }
      }
    };
  }

  /**
   * Add loading state announcement
   * @param {string} message - Loading message
   */
  static announceLoading(message) {
    this.announceToScreenReader(message);
  }

  /**
   * Add error state announcement
   * @param {string} message - Error message
   */
  static announceError(message) {
    this.announceToScreenReader('Error: ' + message);
  }

  /**
   * Add success state announcement
   * @param {string} message - Success message
   */
  static announceSuccess(message) {
    this.announceToScreenReader('Success: ' + message);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityManager;
}
