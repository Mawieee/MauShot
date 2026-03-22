# Multi-Monitor Selection Implementation

## Overview

This document describes the implementation of multi-monitor area selection support for the MauShot screenshot application.

## Problem

Previously, the area selection feature could not extend across multiple monitors. The selection window was created using virtual screen bounds that spanned all displays, but Electron BrowserWindow limitations prevented mouse events from properly extending across monitor boundaries.

## Solution

The solution creates a separate selection window for each monitor and synchronizes mouse events across them using IPC (Inter-Process Communication).

## Architecture Changes

### 1. WindowManager (src/windows/WindowManager.js)

**Changes:**
- Changed from single `selectionWindow` to `selectionWindows` array
- `createSelectionWindow()` now creates a separate BrowserWindow for each display
- Each window is positioned exactly at its display bounds
- Display information is sent to each window via `init-display-info` IPC message
- `closeSelectionWindow()` and `hideSelectionWindow()` updated to handle multiple windows

**Key Code:**
```javascript
// Create a window for each display
allDisplays.forEach((display, index) => {
  const win = new BrowserWindow({
    width: display.bounds.width,
    height: display.bounds.height,
    x: display.bounds.x,
    y: display.bounds.y,
    // ... other options
  });

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
});
```

### 2. Selection Controller (renderer/selection.js)

**Changes:**
- Added multi-monitor state tracking (displayIndex, totalDisplays, displayBounds, etc.)
- Added IPC listeners for cross-window synchronization
- First window (displayIndex 0) acts as the "coordinator"
- Mouse events are broadcast from coordinator to all other windows
- Selection box rendering is adjusted to handle window-relative coordinates
- Each window renders only the portion of selection that intersects with its bounds

**Synchronization Protocol:**
1. `selection-sync-start` - Broadcasted on mouse down
2. `selection-sync-move` - Broadcasted on mouse move
3. `selection-sync-end` - Broadcasted on mouse up
4. `selection-sync-cancel` - Broadcasted on cancel

**Key Code:**
```javascript
// Receive display info from main process
ipcRenderer.on('init-display-info', (event, info) => {
  this.displayIndex = info.displayIndex;
  this.totalDisplays = info.totalDisplays;
  this.displayBounds = info.displayBounds;
  this.isCoordinator = this.displayIndex === 0;
});

// Broadcast mouse events to other windows
ipcRenderer.send('selection-sync-move', { x, y, width, height });
```

### 3. IPC Handlers (main.js)

**New Handlers Added:**
- `selection-sync-start` - Forwards mouse down to all selection windows
- `selection-sync-move` - Forwards mouse move to all selection windows
- `selection-sync-end` - Forwards mouse up to all selection windows
- `selection-sync-cancel` - Forwards cancel to all selection windows

**Key Code:**
```javascript
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
```

### 4. ScreenshotCapture (src/capture/ScreenshotCapture.js)

**Changes:**
- Updated `captureArea()` to detect multi-monitor selections
- Added `_captureSingleDisplay()` for single display captures
- Added `_captureMultiDisplay()` for multi-display selections
- Added `_calculateIntersection()` helper for display intersection detection

**Note:** Due to Electron's desktopCapturer limitations, multi-monitor captures currently capture only the primary display containing the selection start point. Full multi-display image composition would require additional image stitching libraries (like canvas) which have complex build requirements on Windows.

## Usage

With these changes, users can now:

1. Start area selection (Ctrl+Shift+A or from tray)
2. Click and drag on any monitor
3. Continue dragging across to other monitors
4. See the selection box properly render across all monitors
5. Release to capture the selected area

## Technical Details

### Coordinate Systems

The implementation uses two coordinate systems:

1. **Virtual Screen Coordinates** - Absolute coordinates spanning all displays
2. **Window-Relative Coordinates** - Coordinates relative to each selection window

Mouse events are tracked in virtual screen coordinates (using `event.screenX` and `event.screenY`). Each window converts these to window-relative coordinates for rendering the selection box.

### Window Coordination

- Window 0 (first display) is the "coordinator"
- Coordinator broadcasts all mouse events
- Other windows listen and update their visual state
- Only coordinator sends final selection to main process
- All windows close together on completion or cancel

## Future Enhancements

1. **Full Multi-Monitor Capture** - Implement image stitching to capture content from all monitors in the selection
2. **Edge Case Handling** - Better handling of monitors with different DPIs
3. **Visual Feedback** - Improve visual indicators for multi-monitor selections

## Files Modified

1. `src/windows/WindowManager.js` - Multi-window creation and management
2. `renderer/selection.js` - Cross-window synchronization
3. `main.js` - IPC handlers for synchronization
4. `src/capture/ScreenshotCapture.js` - Multi-monitor aware capture
5. `package.json` - No new dependencies required

## Testing

To test multi-monitor selection:

1. Connect multiple monitors to your system
2. Run the application (`npm start`)
3. Start area selection (Ctrl+Shift+A)
4. Click and drag from one monitor to another
5. Verify selection box renders correctly across monitors
6. Release to capture and verify the result

## Troubleshooting

**Selection doesn't extend to second monitor:**
- Verify all monitors are detected (check logs for "Found X display(s)")
- Ensure windows are created for each display
- Check IPC messages are being sent/received

**Selection box renders incorrectly:**
- Verify window positions match display bounds
- Check coordinate transformation in `_updateSelectionBox()`
- Ensure intersection calculation is correct

**Capture only shows one monitor:**
- This is expected behavior with current implementation
- Full multi-monitor capture requires additional image composition
