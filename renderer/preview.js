/**
 * preview.js - Preview window renderer script
 *
 * Handles screenshot annotation and editing functionality.
 * Provides drawing tools (rectangle, arrow, text, highlight, blur)
 * and save/copy operations.
 */

const { ipcRenderer } = require('electron');

/**
 * AnnotationController - Manages drawing and annotation on screenshots
 */
class AnnotationController {
  /**
   * Initialize the annotation controller
   */
  constructor() {
    // Canvas setup
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.textInput = document.getElementById('text-input');
    this.textInputContainer = document.getElementById('text-input-container');
    this.canvasContainer = document.getElementById('canvas-container');

    // State
    this.currentTool = 'select';
    this.currentColor = '#ff0000';
    this.currentLineWidth = 4;
    this.blurAmount = 10;
    this.originalImageData = null;
    this.workingCanvas = null; // Offscreen canvas for blur operations
    this.workingCtx = null;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.annotations = [];
    this.currentFilePath = null;

    // Zoom state
    this.zoomLevel = 1.0;

    // Track text input state to avoid duplicate handlers
    this._textInputActive = false;

    // Selection and dragging state
    this.selectedAnnotation = null;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // UI elements
    this.sizeInfo = document.getElementById('size-info');
    this.toolInfo = document.getElementById('tool-info');
    this.positionInfo = document.getElementById('position-info');
    this.zoomInfo = document.getElementById('zoom-info');

    // Tool mappings
    this.toolButtons = {
      'select-tool': 'select',
      'rect-tool': 'rect',
      'arrow-tool': 'arrow',
      'text-tool': 'text',
      'highlight-tool': 'highlight',
      'blur-tool': 'blur'
    };

    // Track more tools dropdown state
    this.moreToolsDropdown = document.getElementById('more-tools-dropdown');
    this.moreToolsBtn = document.getElementById('more-tools-btn');

    // Bind methods
    this._setupToolButtons();
    this._setupCanvasEvents();
    this._setupKeyboardShortcuts();
    this._setupActionButtons();
    this._setupIpcListeners();
    this._setupResizeHandles();
    this._setupMoreToolsDropdown();
    this._setupZoom();

    console.log('Annotation controller initialized');
  }

  /**
   * Set up tool button click handlers
   *
   * @private
   */
  _setupToolButtons() {
    Object.entries(this.toolButtons).forEach(([id, tool]) => {
      document.getElementById(id).addEventListener('click', () => {
        this.setTool(tool);
      });
    });
  }

  /**
   * Set up canvas mouse events
   *
   * @private
   */
  _setupCanvasEvents() {
    // Store bound refs so we can add/remove document-level listeners during drawing
    this._boundMouseMove = this._handleMouseMove.bind(this);
    this._boundMouseUp = this._handleMouseUp.bind(this);
    this.canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
  }

  /**
   * Set up keyboard shortcuts
   *
   * @private
   */
  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // If text input is active, let it handle certain keys
      if (this._textInputActive) {
        if (e.key === 'Escape') {
          this._cancelTextInput();
        }
        return;
      }

      // Ctrl+C - Copy to clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copyToClipboard();
      }
      // Ctrl+S - Save screenshot
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveScreenshot();
      }
      // Ctrl+Z - Undo
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
      // Ctrl+N - New screenshot (area selection)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        ipcRenderer.send('new-screenshot-request');
      }
      // Ctrl+Delete - Clear all annotations
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        this.clearAll();
      }
      // Delete or Backspace - Delete selected annotation or clear all
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.selectedAnnotation) {
          this.deleteSelected();
        } else {
          this.clearAll();
        }
      }
      // Escape - Close window
      else if (e.key === 'Escape') {
        window.close();
      }
      // Zoom shortcuts
      else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this._changeZoom(0.25);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this._changeZoom(-0.25);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this._resetZoom();
      }
      // Tool shortcuts
      else if (e.key === 'r') {
        this.setTool('rect');
      } else if (e.key === 'a') {
        this.setTool('arrow');
      } else if (e.key === 't') {
        this.setTool('text');
      } else if (e.key === 'h') {
        this.setTool('highlight');
      } else if (e.key === 'b') {
        this.setTool('blur');
      } else if (e.key === 'v') {
        this.setTool('select');
      }
    });
  }

  /**
   * Set up action button handlers
   *
   * @private
   */
  _setupActionButtons() {
    // Color picker
    document.getElementById('color-picker').addEventListener('input', (e) => {
      this.currentColor = e.target.value;
    });

    // Line width
    document.getElementById('line-width').addEventListener('change', (e) => {
      this.currentLineWidth = parseInt(e.target.value);
    });

    // Blur amount
    document.getElementById('blur-amount').addEventListener('change', (e) => {
      this.blurAmount = parseInt(e.target.value);
    });

    // Action buttons
    document.getElementById('undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
    document.getElementById('copy-btn').addEventListener('click', () => this.copyToClipboard());
    document.getElementById('save-btn').addEventListener('click', () => this.saveScreenshot());
    document.getElementById('close-btn').addEventListener('click', () => window.close());

    // New screenshot button - send IPC message to main process
    document.getElementById('new-screenshot-btn').addEventListener('click', () => {
      ipcRenderer.send('new-screenshot-request');
    });

    // Gallery button - send IPC message to main process
    document.getElementById('gallery-btn').addEventListener('click', () => {
      ipcRenderer.send('open-gallery-from-preview');
    });
  }

  /**
   * Set up IPC listeners for main process messages
   *
   * @private
   */
  _setupIpcListeners() {
    /**
     * Load image from main process
     */
    ipcRenderer.on('load-image', (event, data) => {
      console.log('load-image IPC received');
      console.log('Data:', data);
      console.log('ImageData type:', typeof data.imageData);
      console.log('ImageData length:', data.imageData?.length || 'undefined');
      console.log('Bounds:', data.bounds);
      console.log('FilePath:', data.filePath);

      this._loadImage(data.imageData, data.filePath);
    });

    /**
     * Save complete notification
     */
    ipcRenderer.on('save-complete', (event, data) => {
      this.currentFilePath = data.filePath;
      this.showStatus('Screenshot saved: ' + data.filePath);

      // Remove loading state
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        saveBtn.classList.remove('loading');
      }

      // Announce success to screen readers
      if (window.announceSuccess) {
        window.announceSuccess('Screenshot saved successfully');
      }
    });

    /**
     * Save error notification
     */
    ipcRenderer.on('save-error', (event, data) => {
      this.showStatus('Error saving: ' + data.error);

      // Remove loading state
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        saveBtn.classList.remove('loading');
      }

      // Announce error to screen readers
      if (window.announceError) {
        window.announceError('Failed to save screenshot: ' + data.error);
      }
    });
  }

  /**
   * Load an image onto the canvas
   *
   * @param {string} dataUrl - Base64 data URL of the image
   * @param {string} [filePath] - Optional file path if editing existing
   * @private
   */
  _loadImage(dataUrl, filePath) {
    console.log('_loadImage called');
    console.log('Data URL type:', typeof dataUrl);
    console.log('Data URL length:', dataUrl?.length || 'undefined');
    console.log('Data URL prefix:', dataUrl?.substring(0, 50) || 'undefined');

    this.currentFilePath = filePath || null;

    const img = new Image();

    img.onload = () => {
      console.log('Image onload fired');
      console.log('Image dimensions:', img.width, 'x', img.height);

      // Add initial padding around the image for drawing space
      const initialPadding = 100;

      // Set canvas size with padding
      this.canvas.width = img.width + (initialPadding * 2);
      this.canvas.height = img.height + (initialPadding * 2);

      // Store image offset and size for reference
      this.imageOffsetX = initialPadding;
      this.imageOffsetY = initialPadding;
      this.imageWidth = img.width;
      this.imageHeight = img.height;
      this.initialPadding = initialPadding;

      // Fill canvas with white background
      this.ctx.fillStyle = 'white';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw image centered with padding
      this.ctx.drawImage(img, initialPadding, initialPadding);

      // Save original for redraw (deep copy)
      this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Create working canvas for blur operations (doesn't modify original)
      this.workingCanvas = document.createElement('canvas');
      this.workingCanvas.width = this.canvas.width;
      this.workingCanvas.height = this.canvas.height;
      this.workingCtx = this.workingCanvas.getContext('2d', { willReadFrequently: true });
      this.workingCtx.putImageData(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height), 0, 0);

      // Update UI
      this.sizeInfo.textContent = `Size: ${img.width} × ${img.height}`;

      // Apply initial zoom (fit to screen)
      this._applyZoom();

      console.log('Image loaded successfully:', img.width, 'x', img.height, 'with initial padding');
    };

    img.onerror = (e) => {
      console.error('Failed to load image', e);
      console.error('Image src:', img.src?.substring(0, 100));
      alert('Failed to load screenshot. Please try again.');
    };

    console.log('Setting img.src...');
    img.src = dataUrl;
  }

  /**
   * Expand canvas when annotation goes outside current canvas bounds
   *
   * @param {number} minX - Minimum X coordinate of annotation
   * @param {number} minY - Minimum Y coordinate of annotation
   * @param {number} maxX - Maximum X coordinate of annotation
   * @param {number} maxY - Maximum Y coordinate of annotation
   * @param {boolean} duringDrawing - Whether expansion is happening during drawing
   * @private
   */
  _expandCanvasIfNeeded(minX, minY, maxX, maxY) {
    // Calculate needed expansion
    const padding = 50; // Extra padding when expanding
    let needExpansion = false;
    let expandLeft = 0;
    let expandTop = 0;
    let expandRight = 0;
    let expandBottom = 0;

    if (minX < 0) {
      expandLeft = -minX + padding;
      needExpansion = true;
    }
    if (minY < 0) {
      expandTop = -minY + padding;
      needExpansion = true;
    }
    if (maxX > this.canvas.width) {
      expandRight = maxX - this.canvas.width + padding;
      needExpansion = true;
    }
    if (maxY > this.canvas.height) {
      expandBottom = maxY - this.canvas.height + padding;
      needExpansion = true;
    }

    if (!needExpansion) {
      return { expanded: false, expandLeft: 0, expandTop: 0 };
    }

    // Calculate new canvas size
    const newWidth = this.canvas.width + expandLeft + expandRight;
    const newHeight = this.canvas.height + expandTop + expandBottom;

    // Create new canvas with expanded size
    const newCanvas = document.createElement('canvas');
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext('2d');

    // Fill with white background
    newCtx.fillStyle = 'white';
    newCtx.fillRect(0, 0, newWidth, newHeight);

    // Draw old canvas content at new offset
    newCtx.drawImage(this.canvas, expandLeft, expandTop);

    // Update canvas reference
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx.drawImage(newCanvas, 0, 0);

    // Update image offset
    this.imageOffsetX += expandLeft;
    this.imageOffsetY += expandTop;

    // Update original image data
    this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Update working canvas
    this.workingCanvas.width = newWidth;
    this.workingCanvas.height = newHeight;
    this.workingCtx = this.workingCanvas.getContext('2d', { willReadFrequently: true });
    this.workingCtx.putImageData(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height), 0, 0);

    // Update all existing annotations with the expansion offset
    this.annotations.forEach(ann => {
      ann.startX += expandLeft;
      ann.startY += expandTop;
      if (ann.endX !== undefined) ann.endX += expandLeft;
      if (ann.endY !== undefined) ann.endY += expandTop;
    });

    console.log('Canvas expanded to:', newWidth, 'x', newHeight);

    return { expanded: true, expandLeft, expandTop, expandRight, expandBottom };
  }

  /**
   * Scroll the canvas container to position the image at the bottom
   *
   * @private
   */
  _scrollCanvasToBottom() {
    // Wait for the layout to settle before scrolling
    setTimeout(() => {
      const containerHeight = this.canvasContainer.clientHeight;
      const canvasHeight = this.canvas.offsetHeight;

      // Only scroll if canvas is larger than container
      // Otherwise CSS flex-end handles the positioning
      if (canvasHeight > containerHeight) {
        // Scroll to bottom to show canvas at bottom of container
        const scrollTop = this.canvasContainer.scrollHeight - containerHeight;

        this.canvasContainer.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  /**
   * Set the current drawing tool
   *
   * @param {string} tool - Tool name ('select', 'rect', 'arrow', 'text', 'highlight', 'blur')
   */
  setTool(tool) {
    // Cancel any active text input
    if (this._textInputActive) {
      this._cancelTextInput();
    }

    // Clear selection when switching tools
    if (this.selectedAnnotation) {
      this.selectedAnnotation = null;
      this._redrawCanvas();
    }

    this.currentTool = tool;

    // Update button states
    Object.entries(this.toolButtons).forEach(([id, t]) => {
      const btn = document.getElementById(id);
      btn.classList.toggle('active', t === tool);
      // Update aria-pressed for accessibility
      btn.setAttribute('aria-pressed', t === tool ? 'true' : 'false');
    });

    // Update cursor
    if (tool === 'select') {
      this.canvas.style.cursor = 'default';
    } else if (tool === 'text') {
      this.canvas.style.cursor = 'text';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }

    // Update tool info
    const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);
    this.toolInfo.textContent = 'Tool: ' + toolName;

    // Announce tool change for accessibility
    if (window.announceToScreenReader) {
      window.announceToScreenReader(`${toolName} tool selected`);
    }
  }

  /**
   * Handle mouse down on canvas
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseDown(event) {
    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.startX = (event.clientX - rect.left) * scaleX;
    this.startY = (event.clientY - rect.top) * scaleY;

    if (this.currentTool === 'text') {
      this._showTextInput(this.startX, this.startY, event.clientX, event.clientY);
      return;
    }

    // Check if clicking on an annotation (for select tool)
    if (this.currentTool === 'select') {
      const clickedAnnotation = this._findAnnotationAtPosition(this.startX, this.startY);
      if (clickedAnnotation) {
        this.selectedAnnotation = clickedAnnotation;
        this.isDragging = true;
        // Calculate offset based on annotation type
        if (clickedAnnotation.type === 'text') {
          this.dragOffsetX = this.startX - clickedAnnotation.x;
          this.dragOffsetY = this.startY - clickedAnnotation.y;
        } else {
          this.dragOffsetX = this.startX - clickedAnnotation.startX;
          this.dragOffsetY = this.startY - clickedAnnotation.startY;
        }
        this._redrawCanvas();
        document.addEventListener('mousemove', this._boundMouseMove);
        document.addEventListener('mouseup', this._boundMouseUp);
      } else {
        this.selectedAnnotation = null;
        this._redrawCanvas();
      }
      return;
    }

    if (this.currentTool !== 'select') {
      this.isDrawing = true;
      document.addEventListener('mousemove', this._boundMouseMove);
      document.addEventListener('mouseup', this._boundMouseUp);
    }
  }

  /**
   * Handle mouse move on canvas
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    let x = (event.clientX - rect.left) * scaleX;
    let y = (event.clientY - rect.top) * scaleY;

    // Update position info
    this.positionInfo.textContent = `Position: ${Math.round(x)}, ${Math.round(y)}`;

    // Handle dragging any annotation
    if (this.isDragging && this.selectedAnnotation) {
      const deltaX = x - this.dragOffsetX;
      const deltaY = y - this.dragOffsetY;

      if (this.selectedAnnotation.type === 'text') {
        this.selectedAnnotation.x = x - this.dragOffsetX;
        this.selectedAnnotation.y = y - this.dragOffsetY;
      } else {
        const width = this.selectedAnnotation.endX - this.selectedAnnotation.startX;
        const height = this.selectedAnnotation.endY - this.selectedAnnotation.startY;
        this.selectedAnnotation.startX = x - this.dragOffsetX;
        this.selectedAnnotation.startY = y - this.dragOffsetY;
        this.selectedAnnotation.endX = this.selectedAnnotation.startX + width;
        this.selectedAnnotation.endY = this.selectedAnnotation.startY + height;
      }
      this._redrawCanvas();
      return;
    }

    // Update cursor when hovering over annotations in select mode
    if (this.currentTool === 'select' && !this.isDragging) {
      const hoveredAnnotation = this._findAnnotationAtPosition(x, y);
      this.canvas.style.cursor = hoveredAnnotation ? 'move' : 'default';
    }

    if (!this.isDrawing) {
      return;
    }

    // If drawing goes outside current canvas bounds, expand canvas live
    if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) {
      // Restore clean state before expanding so the preview isn't baked in
      if (this.originalImageData) {
        this.ctx.putImageData(this.originalImageData, 0, 0);
      }

      const expansion = this._expandCanvasIfNeeded(
        Math.min(this.startX, x),
        Math.min(this.startY, y),
        Math.max(this.startX, x),
        Math.max(this.startY, y)
      );

      if (expansion.expanded) {
        this.startX += expansion.expandLeft;
        this.startY += expansion.expandTop;
        x += expansion.expandLeft;
        y += expansion.expandTop;

        // Scroll the container to keep the drawing endpoint visible
        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = this.canvasContainer.getBoundingClientRect();
        if (event.clientX > containerRect.right - 20) {
          this.canvasContainer.scrollLeft += expansion.expandRight || 0;
        }
        if (event.clientY > containerRect.bottom - 20) {
          this.canvasContainer.scrollTop += expansion.expandBottom || 0;
        }
      }
    }

    // Redraw with current annotation
    this._redrawCanvas();
    this._drawAnnotation(this.startX, this.startY, x, y);
  }

  /**
   * Handle mouse up on canvas
   *
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  _handleMouseUp(event) {
    // Remove document-level listeners added during drawing
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);

    // Handle ending drag
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    if (!this.isDrawing) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const endX = (event.clientX - rect.left) * scaleX;
    const endY = (event.clientY - rect.top) * scaleY;

    // Save annotation if it has size
    if (Math.abs(endX - this.startX) > 2 || Math.abs(endY - this.startY) > 2) {
      // First, restore canvas to clean state (without preview) before any expansion
      if (this.originalImageData) {
        this.ctx.putImageData(this.originalImageData, 0, 0);
      }

      // Check if annotation extends outside current canvas bounds
      const minX = Math.min(this.startX, endX);
      const minY = Math.min(this.startY, endY);
      const maxX = Math.max(this.startX, endX);
      const maxY = Math.max(this.startY, endY);

      // Expand canvas if annotation goes outside
      const expansion = this._expandCanvasIfNeeded(minX, minY, maxX, maxY);

      // Add expansion offset to coordinates
      const finalStartX = this.startX + (expansion.expanded ? expansion.expandLeft : 0);
      const finalStartY = this.startY + (expansion.expanded ? expansion.expandTop : 0);
      const finalEndX = endX + (expansion.expanded ? expansion.expandLeft : 0);
      const finalEndY = endY + (expansion.expanded ? expansion.expandTop : 0);

      this.annotations.push({
        type: this.currentTool,
        startX: finalStartX,
        startY: finalStartY,
        endX: finalEndX,
        endY: finalEndY,
        color: this.currentColor,
        lineWidth: this.currentLineWidth,
        blurAmount: this.blurAmount
      });
    }

    this.isDrawing = false;
    this._redrawCanvas();
  }

  /**
   * Draw an annotation on the canvas
   *
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {Object} [annotation] - Annotation object (uses current settings if not provided)
   * @private
   */
  _drawAnnotation(x1, y1, x2, y2, annotation = null) {
    const tool = annotation ? annotation.type : this.currentTool;
    const color = annotation ? annotation.color : this.currentColor;
    const lineWidth = annotation ? annotation.lineWidth : this.currentLineWidth;
    const blurStrength = annotation ? annotation.blurAmount : this.blurAmount;

    // Reset canvas state
    this._resetCanvasState();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (tool) {
      case 'rect':
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;

      case 'arrow':
        this._drawArrow(x1, y1, x2, y2, color, lineWidth);
        break;

      case 'highlight':
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.globalAlpha = 1.0;
        break;

      case 'blur':
        this._drawBlurPreview(x1, y1, x2 - x1, y2 - y1);
        break;
    }
  }

  /**
   * Reset canvas context state to defaults
   *
   * @private
   */
  _resetCanvasState() {
    this.ctx.globalAlpha = 1.0;
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.lineWidth = this.currentLineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /**
   * Draw a blur effect preview
   *
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @private
   */
  _drawBlurPreview(x, y, width, height) {
    // Normalize coordinates (handle negative width/height)
    const drawX = width < 0 ? x + width : x;
    const drawY = height < 0 ? y + height : y;
    const drawW = Math.abs(width);
    const drawH = Math.abs(height);

    // Draw a semi-transparent overlay to show where blur will be applied
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
    this.ctx.fillRect(drawX, drawY, drawW, drawH);
    this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 4]);
    this.ctx.strokeRect(drawX, drawY, drawW, drawH);
    this.ctx.restore();
  }

  /**
   * Apply blur effect to a region of the image
   *
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {number} blurStrength - Blur amount (iterations of blur)
   * @private
   */
  _applyBlur(x, y, width, height, blurStrength) {
    // Normalize coordinates
    const drawX = width < 0 ? x + width : x;
    const drawY = height < 0 ? y + height : y;
    const drawW = Math.abs(width);
    const drawH = Math.abs(height);

    // Get the image data for the region from the main canvas
    const imageData = this.ctx.getImageData(
      Math.floor(drawX),
      Math.floor(drawY),
      Math.floor(drawW),
      Math.floor(drawH)
    );

    // Apply box blur multiple times for stronger effect
    const iterations = Math.max(1, Math.floor(blurStrength / 3));
    for (let i = 0; i < iterations; i++) {
      this._boxBlur(imageData, Math.floor(drawW), Math.floor(drawH));
    }

    // Put the blurred image data back
    this.ctx.putImageData(imageData, Math.floor(drawX), Math.floor(drawY));
  }

  /**
   * Apply a simple box blur to image data
   *
   * @param {ImageData} imageData - The image data to blur
   * @param {number} width - Width of the image data
   * @param {number} height - Height of the image data
   * @private
   */
  _boxBlur(imageData, width, height) {
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        // Sample 3x3 area
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += copy[idx];
              g += copy[idx + 1];
              b += copy[idx + 2];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
        // Alpha remains unchanged
      }
    }
  }

  /**
   * Draw an arrow from point to point
   *
   * @param {number} fromX - Start X
   * @param {number} fromY - Start Y
   * @param {number} toX - End X
   * @param {number} toY - End Y
   * @param {string} color - Arrow color
   * @param {number} lineWidth - Line width
   * @private
   */
  _drawArrow(fromX, fromY, toX, toY, color, lineWidth) {
    const headLength = lineWidth * 3;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  /**
   * Show the text input at a position
   *
   * @param {number} canvasX - X position on canvas
   * @param {number} canvasY - Y position on canvas
   * @param {number} clientX - X position in viewport
   * @param {number} clientY - Y position in viewport
   * @private
   */
  _showTextInput(canvasX, canvasY, clientX, clientY) {
    // Cancel any existing text input
    if (this._textInputActive) {
      this._cancelTextInput();
    }

    // Get canvas bounding rectangle
    const rect = this.canvas.getBoundingClientRect();
    const containerRect = this.canvasContainer.getBoundingClientRect();

    // Calculate the position relative to the canvas element
    // The canvas may be scrolled within the container
    const canvasOffsetLeft = rect.left - containerRect.left;
    const canvasOffsetTop = rect.top - containerRect.top;

    // Calculate scale factors between canvas intrinsic size and displayed size
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;

    // Calculate text input position relative to the canvas container
    // accounting for scroll position and canvas scaling
    const inputX = canvasOffsetLeft + (canvasX * scaleX);
    const inputY = canvasOffsetTop + (canvasY * scaleY);

    const fontSize = this.currentLineWidth * 3;

    // Style the text input container
    this.textInputContainer.style.left = inputX + 'px';
    this.textInputContainer.style.top = inputY + 'px';
    this.textInputContainer.style.display = 'block';
    this.textInputContainer.style.width = '150px';
    this.textInputContainer.style.minHeight = (fontSize + 16) + 'px';

    // Style the text input
    this.textInput.style.color = this.currentColor;
    this.textInput.style.fontSize = fontSize + 'px';
    this.textInput.style.fontFamily = 'Arial, sans-serif';
    this.textInput.value = '';

    this._textInputActive = true;
    this._pendingTextPosition = { x: canvasX, y: canvasY };

    // Focus after a brief delay
    setTimeout(() => {
      this.textInput.focus();
    }, 10);

    // Set up handlers
    this._textInputHandler = this._handleTextInputFinish.bind(this);
    this._boundKeyHandler = this._textInputKeyHandler.bind(this);
    this._inputHandler = this._autoResizeTextarea.bind(this);

    this.textInput.addEventListener('keydown', this._boundKeyHandler);
    this.textInput.addEventListener('blur', this._textInputHandler);
    this.textInput.addEventListener('input', this._inputHandler);
  }

  /**
   * Handle text input keydown event
   *
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  _textInputKeyHandler(e) {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter for line breaks - manually insert newline
        e.preventDefault();
        const start = this.textInput.selectionStart;
        const end = this.textInput.selectionEnd;
        const value = this.textInput.value;

        this.textInput.value = value.substring(0, start) + '\n' + value.substring(end);
        this.textInput.selectionStart = this.textInput.selectionEnd = start + 1;

        // Auto-resize after inserting newline
        this._autoResizeTextarea();
      } else {
        // Enter confirms the text
        e.preventDefault();
        this._handleTextInputFinish();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelTextInput();
    }
  }

  /**
   * Auto-resize textarea to fit content
   *
   * @private
   */
  _autoResizeTextarea() {
    this.textInput.style.height = 'auto';
    this.textInput.style.height = this.textInput.scrollHeight + 'px';
  }

  /**
   * Handle text input completion
   *
   * @private
   */
  _handleTextInputFinish() {
    if (!this._textInputActive) return;

    const text = this.textInput.value.trim();
    const pos = this._pendingTextPosition;

    if (text && pos) {
      const annotation = {
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: text,
        color: this.currentColor,
        fontSize: this.currentLineWidth * 3
      };

      // Expand canvas if text goes beyond boundaries
      const metrics = this._getTextMetrics(text, annotation.fontSize);
      const expansion = this._expandCanvasIfNeeded(
        annotation.x,
        annotation.y,
        annotation.x + metrics.width,
        annotation.y + metrics.height
      );
      if (expansion.expanded) {
        annotation.x += expansion.expandLeft;
        annotation.y += expansion.expandTop;
      }

      this.annotations.push(annotation);
      this._redrawCanvas();
    }

    this._hideTextInput();
  }

  /**
   * Cancel text input without saving
   *
   * @private
   */
  _cancelTextInput() {
    if (!this._textInputActive) return;
    this._hideTextInput();
  }

  /**
   * Hide and reset the text input
   *
   * @private
   */
  _hideTextInput() {
    this.textInputContainer.style.display = 'none';
    this.textInput.value = '';
    this.textInputContainer.classList.remove('resizing');

    if (this._boundKeyHandler) {
      this.textInput.removeEventListener('keydown', this._boundKeyHandler);
    }
    if (this._textInputHandler) {
      this.textInput.removeEventListener('blur', this._textInputHandler);
    }
    if (this._inputHandler) {
      this.textInput.removeEventListener('input', this._inputHandler);
    }

    this._textInputActive = false;
    this._pendingTextPosition = null;
    this._boundKeyHandler = null;
    this._textInputHandler = null;
    this._inputHandler = null;
  }

  /**
   * Redraw the canvas with original image and all annotations
   *
   * @private
   */
  _redrawCanvas() {
    // Always restore from the truly original image data
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }

    // Reset canvas state
    this._resetCanvasState();

    // First, apply all blur annotations (they modify the canvas directly)
    this.annotations.forEach(annotation => {
      if (annotation.type === 'blur') {
        const width = annotation.endX - annotation.startX;
        const height = annotation.endY - annotation.startY;
        this._applyBlur(
          annotation.startX,
          annotation.startY,
          width,
          height,
          annotation.blurAmount
        );
      }
    });

    // Then draw other annotations on top
    this.annotations.forEach(annotation => {
      if (annotation.type === 'blur') return; // Skip blur, already applied

      // Reset state for each annotation
      this._resetCanvasState();

      this.ctx.strokeStyle = annotation.color;
      this.ctx.fillStyle = annotation.color;
      this.ctx.lineWidth = annotation.lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      switch (annotation.type) {
        case 'rect':
          this.ctx.strokeRect(
            annotation.startX,
            annotation.startY,
            annotation.endX - annotation.startX,
            annotation.endY - annotation.startY
          );
          // Draw selection indicator
          if (this.selectedAnnotation === annotation) {
            this._drawSelectionIndicator(
              annotation.startX, annotation.startY,
              annotation.endX, annotation.endY
            );
          }
          break;

        case 'arrow':
          this._drawArrow(
            annotation.startX,
            annotation.startY,
            annotation.endX,
            annotation.endY,
            annotation.color,
            annotation.lineWidth
          );
          // Draw selection indicator for arrow
          if (this.selectedAnnotation === annotation) {
            this._drawArrowSelectionIndicator(annotation);
          }
          break;

        case 'highlight':
          this.ctx.globalAlpha = 0.3;
          this.ctx.fillRect(
            annotation.startX,
            annotation.startY,
            annotation.endX - annotation.startX,
            annotation.endY - annotation.startY
          );
          this.ctx.globalAlpha = 1.0;
          // Draw selection indicator
          if (this.selectedAnnotation === annotation) {
            this._drawSelectionIndicator(
              annotation.startX, annotation.startY,
              annotation.endX, annotation.endY
            );
          }
          break;

        case 'text':
          // Calculate the scale ratio between intrinsic canvas size and displayed size
          const rect = this.canvas.getBoundingClientRect();
          const fontScale = this.canvas.width / rect.width;
          const scaledFontSize = annotation.fontSize * fontScale;

          this.ctx.font = scaledFontSize + 'px Arial, sans-serif';
          this.ctx.textBaseline = 'top';
          this._drawMultilineText(annotation.text, annotation.x, annotation.y, scaledFontSize);

          // Draw selection indicator for selected text
          if (this.selectedAnnotation === annotation) {
            const metrics = this._getTextMetrics(annotation.text, annotation.fontSize);
            this.ctx.save();
            this.ctx.strokeStyle = '#0078d4';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
              annotation.x - 3,
              annotation.y - 3,
              metrics.width + 6,
              metrics.height + 6
            );
            this.ctx.restore();
          }
          break;
      }
    });

    // Draw selection indicator for blur annotations (on top of everything)
    this.annotations.forEach(annotation => {
      if (annotation.type === 'blur' && this.selectedAnnotation === annotation) {
        this._drawSelectionIndicator(
          annotation.startX, annotation.startY,
          annotation.endX, annotation.endY
        );
      }
    });
  }

  /**
   * Undo the last annotation
   */
  undo() {
    if (this.annotations.length > 0) {
      this.annotations.pop();
      this._redrawCanvas();
      // Announce undo action
      if (window.announceToScreenReader) {
        window.announceToScreenReader('Annotation undone');
      }
    }
  }

  /**
   * Clear all annotations
   */
  clearAll() {
    this.annotations = [];
    this.selectedAnnotation = null;
    this._redrawCanvas();
  }

  /**
   * Delete the currently selected annotation
   */
  deleteSelected() {
    if (this.selectedAnnotation) {
      const index = this.annotations.indexOf(this.selectedAnnotation);
      if (index > -1) {
        this.annotations.splice(index, 1);
      }
      this.selectedAnnotation = null;
      this._redrawCanvas();
    }
  }

  /**
   * Copy the current canvas to clipboard
   */
  copyToClipboard() {
    const dataUrl = this._getExportImageData();
    ipcRenderer.send('copy-to-clipboard', dataUrl);
    this.showStatus('Copied to clipboard!');
    // Announce to screen readers
    if (window.announceSuccess) {
      window.announceSuccess('Screenshot copied to clipboard');
    }
  }

  /**
   * Save the current screenshot
   */
  saveScreenshot() {
    console.log('Saving screenshot...');

    // Show loading state
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.classList.add('loading');
    }

    // Announce loading
    if (window.announceToScreenReader) {
      window.announceToScreenReader('Saving screenshot...');
    }

    const dataUrl = this._getExportImageData();
    ipcRenderer.send('save-screenshot', {
      imageData: dataUrl,
      bounds: { x: 0, y: 0 }
    });
  }

  /**
   * Check if any annotation extends outside the original image bounds
   *
   * @returns {boolean} True if any annotation extends outside original bounds
   * @private
   */
  _hasAnnotationsOutsideOriginalBounds() {
    const originalLeft = this.imageOffsetX;
    const originalTop = this.imageOffsetY;
    const originalRight = this.imageOffsetX + this.imageWidth;
    const originalBottom = this.imageOffsetY + this.imageHeight;

    return this.annotations.some(annotation => {
      let minX, minY, maxX, maxY;

      if (annotation.type === 'text') {
        minX = annotation.x;
        minY = annotation.y;
        maxX = annotation.x + 100; // Approximate text width
        maxY = annotation.y + annotation.fontSize;
      } else {
        minX = Math.min(annotation.startX, annotation.endX || annotation.startX);
        minY = Math.min(annotation.startY, annotation.endY || annotation.startY);
        maxX = Math.max(annotation.startX, annotation.endX || annotation.startX);
        maxY = Math.max(annotation.startY, annotation.endY || annotation.startY);
      }

      // Check if annotation extends outside original bounds
      return minX < originalLeft || minY < originalTop ||
             maxX > originalRight || maxY > originalBottom;
    });
  }

  /**
   * Get the export image data, cropped to original bounds if possible
   *
   * @returns {string} Base64 data URL of the image
   * @private
   */
  _getExportImageData() {
    // If no annotations, or all annotations are inside original bounds, crop to original
    if (this.annotations.length === 0 || !this._hasAnnotationsOutsideOriginalBounds()) {
      // Create a temporary canvas with just the original image dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.imageWidth;
      tempCanvas.height = this.imageHeight;
      const tempCtx = tempCanvas.getContext('2d');

      // Copy just the original image area from the main canvas
      tempCtx.drawImage(
        this.canvas,
        this.imageOffsetX, this.imageOffsetY, this.imageWidth, this.imageHeight, // Source
        0, 0, this.imageWidth, this.imageHeight // Destination
      );

      return tempCanvas.toDataURL('image/png');
    }

    // Otherwise, export the full expanded canvas
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Show a status message temporarily
   *
   * @param {string} message - Status message to display
   */
  showStatus(message) {
    const statusBar = document.querySelector('.status-bar');
    const originalHTML = statusBar.innerHTML;

    statusBar.innerHTML = `<span style="color: #4ec9b0;">${message}</span>`;

    setTimeout(() => {
      statusBar.innerHTML = `
        <div class="status-info">
          <span id="size-info">${this.sizeInfo.textContent}</span>
          <span id="tool-info">${this.toolInfo.textContent}</span>
          <span id="position-info">${this.positionInfo.textContent}</span>
        </div>
        <div>
          <kbd>Ctrl+C</kbd> Copy &nbsp;
          <kbd>Ctrl+S</kbd> Save &nbsp;
          <kbd>Ctrl+Z</kbd> Undo &nbsp;
          <kbd>Del</kbd> Delete &nbsp;
          <kbd>Ctrl+Del</kbd> Clear All &nbsp;
          <kbd>Esc</kbd> Close &nbsp;
          <kbd>Ctrl+Shift+A</kbd> Area &nbsp;
          <kbd>Ctrl+Shift+F</kbd> Full
        </div>
      `;
    }, 2000);
  }

  /**
   * Set up resize handles for the text input container
   *
   * @private
   */
  _setupResizeHandles() {
    const handles = this.textInputContainer.querySelectorAll('.resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let startWidth = 0;
    let startHeight = 0;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        currentHandle = handle.dataset.handle;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = this.textInputContainer.offsetLeft;
        startTop = this.textInputContainer.offsetTop;
        startWidth = this.textInputContainer.offsetWidth;
        startHeight = this.textInputContainer.offsetHeight;

        this.textInputContainer.classList.add('resizing');
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Handle different resize directions
      if (currentHandle === 'e' || currentHandle === 'ne' || currentHandle === 'se') {
        const newWidth = Math.max(100, startWidth + deltaX);
        this.textInputContainer.style.width = newWidth + 'px';
      }

      if (currentHandle === 's' || currentHandle === 'se' || currentHandle === 'sw') {
        const newHeight = Math.max(30, startHeight + deltaY);
        this.textInputContainer.style.height = newHeight + 'px';
      }

      if (currentHandle === 'w' || currentHandle === 'nw' || currentHandle === 'sw') {
        const newWidth = Math.max(100, startWidth - deltaX);
        if (newWidth > 100) {
          this.textInputContainer.style.width = newWidth + 'px';
          this.textInputContainer.style.left = (startLeft + deltaX) + 'px';
        }
      }

      if (currentHandle === 'n' || currentHandle === 'nw' || currentHandle === 'ne') {
        const newHeight = Math.max(30, startHeight - deltaY);
        if (newHeight > 30) {
          this.textInputContainer.style.height = newHeight + 'px';
          this.textInputContainer.style.top = (startTop + deltaY) + 'px';
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentHandle = null;
        this.textInputContainer.classList.remove('resizing');
      }
    });
  }

  /**
   * Set up the "more tools" dropdown functionality
   *
   * @private
   */
  _setupMoreToolsDropdown() {
    // Toggle dropdown on button click
    this.moreToolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = this.moreToolsDropdown.classList.contains('show');
      this._toggleMoreToolsDropdown(!isOpen);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.moreToolsDropdown.classList.contains('show')) {
        if (!this.moreToolsBtn.contains(e.target) && !this.moreToolsDropdown.contains(e.target)) {
          this._toggleMoreToolsDropdown(false);
        }
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.moreToolsDropdown.classList.contains('show')) {
        this._toggleMoreToolsDropdown(false);
        this.moreToolsBtn.focus();
      }
    });

    // Handle keyboard navigation within dropdown
    this.moreToolsDropdown.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(this.moreToolsDropdown.querySelectorAll('.tool-btn'));
        const currentIndex = items.indexOf(document.activeElement);
        let nextIndex;

        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        items[nextIndex].focus();
      } else if (e.key === 'Enter' && document.activeElement.classList.contains('tool-btn')) {
        e.preventDefault();
        document.activeElement.click();
      }
    });
  }

  /**
   * Toggle the more tools dropdown visibility
   *
   * @param {boolean} show - Whether to show or hide the dropdown
   * @private
   */
  _toggleMoreToolsDropdown(show) {
    if (show) {
      this.moreToolsDropdown.classList.add('show');
      this.moreToolsBtn.setAttribute('aria-expanded', 'true');
      // Focus first tool in dropdown
      const firstTool = this.moreToolsDropdown.querySelector('.tool-btn');
      if (firstTool) {
        setTimeout(() => firstTool.focus(), 100);
      }
    } else {
      this.moreToolsDropdown.classList.remove('show');
      this.moreToolsBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Set up zoom controls (wheel, buttons)
   *
   * @private
   */
  _setupZoom() {
    // Ctrl+Wheel to zoom
    this.canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        this._changeZoom(delta);
      }
    }, { passive: false });

    // Zoom buttons
    document.getElementById('zoom-in-btn').addEventListener('click', () => this._changeZoom(0.25));
    document.getElementById('zoom-out-btn').addEventListener('click', () => this._changeZoom(-0.25));
    document.getElementById('zoom-reset-btn').addEventListener('click', () => this._resetZoom());
  }

  /**
   * Change zoom level by a delta amount
   *
   * @param {number} delta - Amount to add to zoom level
   * @private
   */
  _changeZoom(delta) {
    this.zoomLevel = Math.min(8, Math.max(0.25, this.zoomLevel + delta));
    this._applyZoom();
  }

  /**
   * Reset zoom to fit-to-screen (1.0)
   *
   * @private
   */
  _resetZoom() {
    this.zoomLevel = 1.0;
    this._applyZoom();
  }

  /**
   * Apply the current zoom level to the canvas element via CSS sizing.
   * The existing scaleX/scaleY calculations in mouse handlers automatically
   * compensate because they use canvas.width / rect.width.
   *
   * @private
   */
  _applyZoom() {
    if (!this.canvas.width || !this.canvas.height) return;

    const containerW = this.canvasContainer.clientWidth - 40;
    const containerH = this.canvasContainer.clientHeight - 40;

    // Fit scale: how large the canvas should be at zoomLevel=1 to fit the container
    const fitScale = Math.min(
      containerW / this.canvas.width,
      containerH / this.canvas.height,
      1
    );

    const displayW = Math.round(this.canvas.width * fitScale * this.zoomLevel);
    const displayH = Math.round(this.canvas.height * fitScale * this.zoomLevel);

    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';
    this.canvas.style.maxWidth = 'none';
    this.canvas.style.maxHeight = 'none';

    // Update zoom display
    const pct = Math.round(this.zoomLevel * 100);
    if (this.zoomInfo) {
      this.zoomInfo.textContent = `Zoom: ${pct}%`;
    }
    const resetBtn = document.getElementById('zoom-reset-btn');
    if (resetBtn) {
      resetBtn.textContent = `${pct}%`;
    }
  }

  /**
   * Find any annotation at the given position
   *
   * @param {number} x - X position on canvas
   * @param {number} y - Y position on canvas
   * @returns {Object|null} The annotation if found, null otherwise
   * @private
   */
  _findAnnotationAtPosition(x, y) {
    // Search in reverse order (topmost first)
    for (let i = this.annotations.length - 1; i >= 0; i--) {
      const annotation = this.annotations[i];

      switch (annotation.type) {
        case 'text':
          const metrics = this._getTextMetrics(annotation.text, annotation.fontSize);
          // Check if point is within the text bounds (with some padding)
          if (x >= annotation.x - 5 &&
              x <= annotation.x + metrics.width + 5 &&
              y >= annotation.y - 5 &&
              y <= annotation.y + metrics.height + 5) {
            return annotation;
          }
          break;

        case 'rect':
        case 'highlight':
        case 'blur':
          // Check if point is within or near the rectangle
          const minX = Math.min(annotation.startX, annotation.endX);
          const maxX = Math.max(annotation.startX, annotation.endX);
          const minY = Math.min(annotation.startY, annotation.endY);
          const maxY = Math.max(annotation.startY, annotation.endY);
          // Add some padding for easier selection
          if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
            return annotation;
          }
          break;

        case 'arrow':
          // Check if point is near the arrow line
          if (this._isPointNearArrow(x, y, annotation)) {
            return annotation;
          }
          break;
      }
    }
    return null;
  }

  /**
   * Check if a point is near an arrow annotation
   *
   * @param {number} x - X position to check
   * @param {number} y - Y position to check
   * @param {Object} annotation - Arrow annotation
   * @returns {boolean} True if point is near the arrow
   * @private
   */
  _isPointNearArrow(x, y, annotation) {
    const threshold = 10; // Distance threshold in pixels
    const fromX = annotation.startX;
    const fromY = annotation.startY;
    const toX = annotation.endX;
    const toY = annotation.endY;

    // Check distance from point to line segment
    const distance = this._pointToLineDistance(x, y, fromX, fromY, toX, toY);
    return distance <= threshold;
  }

  /**
   * Calculate the distance from a point to a line segment
   *
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @param {number} x1 - Line start X
   * @param {number} y1 - Line start Y
   * @param {number} x2 - Line end X
   * @param {number} y2 - Line end Y
   * @returns {number} Distance from point to line segment
   * @private
   */
  _pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Draw a selection indicator around a rectangular area
   *
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @private
   */
  _drawSelectionIndicator(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    this.ctx.save();
    this.ctx.strokeStyle = '#0078d4';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(minX - 5, minY - 5, (maxX - minX) + 10, (maxY - minY) + 10);
    this.ctx.restore();
  }

  /**
   * Draw a selection indicator for an arrow annotation
   *
   * @param {Object} annotation - Arrow annotation
   * @private
   */
  _drawArrowSelectionIndicator(annotation) {
    this.ctx.save();
    this.ctx.strokeStyle = '#0078d4';
    this.ctx.lineWidth = annotation.lineWidth + 4;
    this.ctx.setLineDash([5, 5]);
    this.ctx.lineCap = 'round';
    this._drawArrow(
      annotation.startX,
      annotation.startY,
      annotation.endX,
      annotation.endY,
      '#0078d4',
      annotation.lineWidth + 2
    );
    this.ctx.restore();
  }

  /**
   * Get text metrics for measuring text size
   *
   * @param {string} text - The text to measure
   * @param {number} fontSize - The font size in pixels
   * @returns {Object} Object with width and height properties
   * @private
   */
  _getTextMetrics(text, fontSize) {
    // Calculate the scale ratio between intrinsic canvas size and displayed size
    const rect = this.canvas.getBoundingClientRect();
    const fontScale = this.canvas.width / rect.width;
    const scaledFontSize = fontSize * fontScale;

    this.ctx.font = scaledFontSize + 'px Arial, sans-serif';
    const lines = text.split('\n');
    let maxWidth = 0;

    lines.forEach(line => {
      const metrics = this.ctx.measureText(line);
      if (metrics.width > maxWidth) {
        maxWidth = metrics.width;
      }
    });

    const lineHeight = scaledFontSize * 1.2;
    return {
      width: maxWidth,
      height: lines.length * lineHeight
    };
  }

  /**
   * Draw multiline text
   *
   * @param {string} text - The text to draw (can contain newlines)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} fontSize - Font size
   * @private
   */
  _drawMultilineText(text, x, y, fontSize) {
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.2;

    lines.forEach((line, index) => {
      this.ctx.fillText(line, x, y + (index * lineHeight));
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Preview window loaded');
  window.annotationController = new AnnotationController();
});
