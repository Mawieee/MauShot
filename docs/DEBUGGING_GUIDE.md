# Debugging Guide for Area Selection Fix

## Quick Start

1. Run the application:
   ```bash
   npm start
   ```
   Or use the debug script:
   ```bash
   debug-test.bat
   ```

2. Open the Developer Tools:
   - When the main window appears, press `Ctrl+Shift+I`
   - This will show the console with all debug messages

3. Test area selection:
   - Click "Select Area" or press `Ctrl+Shift+A`
   - Drag to select an area
   - Release mouse
   - Check console output

## Expected Console Output

### Step 1: Start Selection
```
=== START SELECTION ===
Cursor position: { x: 960, y: 540 }
Creating selection window with bounds: { x: 0, y: 0, width: 1920, height: 1080 }
Loading selection.html...
Selection window ready to show
Selection window shown and focused
=== START SELECTION COMPLETE ===
```

### Step 2: Mouse Events (Selection Window Console)
```
Mousedown at: 500, 300
Inside valid selection block
=== VALID SELECTION BLOCK START ===
Selection point: { x: 500, y: 300 }
Display bounds: { x: 0, y: 0, width: 1920, height: 1080 }
Calculated relative bounds: { x: 500, y: 300, width: 400, height: 300 }
About to send selection-complete IPC message
=== SUCCESSFULLY SENT selection-complete ===
```

### Step 3: Main Process Capture
```
=== SELECTION COMPLETE START ===
Hiding selection window before capture
Target display: { x: 0, y: 0, width: 1920, height: 1080 }
Requesting capture with thumbnailSize: { width: 1920, height: 1080 }
Sources found: 1
Using source: Entire Screen or Screen 1
Source thumbnail size: { width: 1920, height: 1080 }
Full image size: { width: 1920, height: 1080 }
Crop bounds (before validation): { cropX: 500, cropY: 300, cropWidth: 400, cropHeight: 300 }
Performing crop with bounds: { x: 500, y: 300, width: 400, height: 300 }
Cropped image size: { width: 400, height: 300 }
Closing selection window
Creating preview window...
=== CREATE PREVIEW WINDOW START ===
Loading preview.html...
Preview window finished loading
Converted Buffer to base64, length: 123456
Sending load-image message with data URL length: 123478
Load image message sent
Preview window ready to show
=== CREATE PREVIEW WINDOW END ===
=== SELECTION COMPLETE SUCCESS ===
```

### Step 4: Preview Window Console
```
=== LOAD IMAGE START ===
Image data type: string
Image data length: 123478
Bounds: { x: 500, y: 300, width: 400, height: 300 }
File path: null
Setting image source...
Image loaded successfully, size: 400 x 300
Canvas setup complete, original image data saved
=== LOAD IMAGE COMPLETE ===
```

## Common Issues and Solutions

### Issue 1: "No screen sources found"

**Symptoms:**
```
Sources found: 0
No screen sources found - desktopCapturer returned empty array
=== SELECTION COMPLETE FAILED ===
```

**Possible Causes:**
1. Windows permission issue - Screen recording permission not granted
2. Electron version issue
3. Selection window still visible interfering with capture

**Solutions:**
1. Check Windows privacy settings:
   - Settings > Privacy > Screen recording
   - Enable screen recording for your app
2. Verify the fix is applied - selection window should be hidden BEFORE capture
3. Try running as administrator

### Issue 2: "Cropped image is empty"

**Symptoms:**
```
Cropped image size: { width: 0, height: 0 }
Cropped image is empty - crop operation failed
```

**Possible Causes:**
1. Crop bounds are outside image dimensions
2. Invalid coordinate calculations

**Solutions:**
1. Check the "Crop bounds (before validation)" log message
2. Verify display bounds match actual screen resolution
3. Check if multi-monitor setup is causing coordinate issues

### Issue 3: Preview window doesn't appear

**Symptoms:**
```
Creating preview window...
=== CREATE PREVIEW WINDOW START ===
```
Then nothing else.

**Possible Causes:**
1. preview.html failed to load
2. Error in createPreviewWindow function
3. Image data corrupted

**Solutions:**
1. Check for "PREVIEW WINDOW FAILED TO LOAD" message
2. Verify preview.html exists and is valid
3. Check if image data is being converted correctly

### Issue 4: Black image in preview

**Symptoms:**
Preview window appears but shows black image.

**Possible Causes:**
1. Wrong thumbnailSize used for capture
2. Crop coordinates incorrect
3. Image format issue

**Solutions:**
1. Verify thumbnailSize matches display dimensions exactly
2. Check crop bounds calculation
3. Verify image is being converted to base64 correctly

## Debugging Commands

### Enable Electron Debug Mode
```bash
npm start -- --enable-logging --v=1
```

### Check Syntax
```bash
node -c main.js
node -c selection.html  # Won't work for HTML
```

### Manual Testing
```javascript
// In the main process console:
screen.getAllDisplays()
screen.getPrimaryDisplay()
screen.getDisplayNearestPoint({x: 100, y: 100})
```

## Log File Locations

If console output is not available, check:
1. Electron logs in `%APPDATA%\Local\electron-app\logs`
2. Windows Event Viewer for system-level errors
3. Run with `--enable-logging` flag to create log files

## Multi-Monitor Testing

If using multiple monitors:
1. Test selection on primary monitor
2. Test selection on secondary monitor
3. Test selection spanning monitors (if applicable)
4. Check coordinates for each display

Expected behavior:
- `getDisplayNearestPoint()` should return the display where selection occurred
- Bounds should be relative to that display's origin
- Thumbnail size should match that display's resolution

## Performance Considerations

The fix includes these performance optimizations:
1. Selection window hidden before capture (prevents interference)
2. Thumbnail size matches display resolution (no scaling needed)
3. Direct crop without scale calculations (faster)
4. Preview window shown after load (prevents flash)

## Next Steps if Issues Persist

1. Verify all changes are applied correctly
2. Check Electron version compatibility
3. Test on a clean install
4. Create a minimal reproduction case
5. Check Windows event logs for errors
6. Try with antivirus temporarily disabled

## Contact Information

If issues continue:
1. Collect full console output
2. Note exact reproduction steps
3. Include system information (Windows version, Electron version, etc.)
4. Include screenshots of the issue
