# Multi-Monitor Selection - Quick Reference

## Summary of Changes

### What Was Fixed

The area selection feature now supports dragging the selection across multiple monitors. Previously, users could only select areas within a single monitor.

### How It Works

1. **Multiple Selection Windows**: The app now creates a separate transparent overlay window for each connected monitor
2. **Event Synchronization**: Mouse events are synchronized across all windows via IPC
3. **Coordinated Rendering**: The first window acts as coordinator, broadcasting mouse movements to all other windows
4. **Unified Capture**: Selection coordinates are tracked in virtual screen space, enabling cross-monitor selections

## Key Files Changed

| File | Purpose |
|------|---------|
| `src/windows/WindowManager.js` | Creates one window per display instead of single window |
| `renderer/selection.js` | Handles cross-window synchronization and coordinate transforms |
| `main.js` | Adds IPC handlers for broadcasting mouse events |
| `src/capture/ScreenshotCapture.js` | Multi-monitor aware capture logic |

## New IPC Messages

### From Main to Renderer
- `init-display-info` - Sends display configuration to each selection window
- `selection-synced-start` - Broadcasts mouse down event
- `selection-synced-move` - Broadcasts mouse move event
- `selection-synced-end` - Broadcasts mouse up event
- `selection-synced-cancel` - Broadcasts cancel event

### From Renderer to Main
- `selection-sync-start` - Initiates selection synchronization
- `selection-sync-move` - Sends mouse move updates
- `selection-sync-end` - Completes selection
- `selection-sync-cancel` - Cancels selection

## Usage

1. Press `Ctrl+Shift+A` or select "Take Screenshot" from tray
2. Click on any monitor to start selection
3. Drag across multiple monitors as needed
4. Release mouse to complete selection
5. Screenshot is captured and preview window opens

## Technical Notes

### Coordinate System
- All mouse positions are tracked in **virtual screen coordinates** (absolute)
- Each window converts to **window-relative coordinates** for rendering
- Virtual screen bounds = bounding box of all displays

### Limitations
- Current implementation captures from primary display only
- Full multi-monitor image composition requires additional dependencies
- Works best with monitors at same DPI scale

### Browser Window Configuration
Each selection window is configured as:
```javascript
{
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false
}
```

## Testing Checklist

- [ ] Selection starts on monitor 1, extends to monitor 2
- [ ] Selection starts on monitor 2, extends to monitor 1
- [ ] Selection box renders correctly on both monitors
- [ ] Capture works for single-monitor selection
- [ ] Capture works for multi-monitor selection
- [ ] Cancel (Escape) works correctly
- [ ] Full screen button works correctly

## Troubleshooting

**Issue**: Mouse drag doesn't extend to second monitor
**Solution**: Check that multiple windows are created (look for "Creating selection window for display X" in logs)

**Issue**: Selection box appears in wrong position
**Solution**: Verify display bounds are correctly calculated (check "Virtual screen bounds" in logs)

**Issue**: Only one monitor is captured
**Solution**: This is expected with current implementation. Full multi-monitor capture requires additional image composition.

## Future Enhancements

1. Implement full multi-monitor image stitching
2. Add support for monitors with different DPIs
3. Improve visual feedback for multi-monitor selections
4. Add per-monitor capture options

## Related Documentation

- Full implementation details: `docs/MULTI_MONITOR_IMPLEMENTATION.md`
- Project architecture: `CLAUDE.md`
