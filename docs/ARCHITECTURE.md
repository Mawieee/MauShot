# Screenshot App Architecture

A modular, well-organized Electron screenshot application with annotation capabilities.

## Project Structure

```
screenshot-app/
├── main.js                     # Application entry point
├── package.json                # Project configuration
│
├── src/                        # Main process modules
│   ├── windows/
│   │   └── WindowManager.js    # Creates and manages all windows
│   │
│   ├── capture/
│   │   └── ScreenshotCapture.js # Screen capture logic
│   │
│   ├── storage/
│   │   ├── ScreenshotStore.js  # Metadata persistence
│   │   └── StorageManager.js   # High-level file operations
│   │
│   ├── ui/
│   │   └── TrayManager.js      # System tray management
│   │
│   ├── shortcuts/
│   │   └── KeyboardShortcuts.js # Global shortcut handling
│   │
│   └── utils/
│       ├── logger.js           # Centralized logging
│       ├── paths.js            # Path resolution utilities
│       └── imageHelpers.js     # Image processing helpers
│
├── renderer/                   # Renderer process scripts
│   ├── selection.js            # Area selection UI controller
│   ├── preview.js              # Annotation/editing UI controller
│   └── gallery.js              # Gallery UI controller
│
├── assets/                     # Static assets
│   └── icon.png
│
└── *.html                      # Window templates (index, selection, preview, gallery)
```

## Module Overview

### Main Process Modules (`src/`)

#### WindowManager.js
**Purpose**: Creates and manages all application windows

**Key Methods**:
- `createMainWindow()` - Main window with action buttons
- `createSelectionWindow()` - Full-screen overlay for area selection
- `createPreviewWindow(imageData, bounds, filePath)` - Annotation editor window
- `createGalleryWindow()` - Screenshot library viewer

#### ScreenshotCapture.js
**Purpose**: Handles screen capture using Electron's desktopCapturer

**Key Methods**:
- `captureFullScreen()` - Captures the primary display
- `captureArea(bounds, absoluteCoords)` - Captures a specific screen area
- `getAllDisplays()` - Returns all available displays

#### StorageManager.js
**Purpose**: High-level file storage operations

**Key Methods**:
- `saveScreenshot(imageData, filename)` - Save image and create thumbnail
- `deleteScreenshot(id)` - Delete screenshot and its files
- `getAllScreenshots()` - Get all screenshot metadata
- `getScreenshot(id)` - Get specific screenshot by ID

#### ScreenshotStore.js
**Purpose**: Low-level metadata persistence (used by StorageManager)

**Key Methods**:
- `load()` - Load metadata from disk
- `save()` - Save metadata to disk
- `addScreenshot(filePath, thumbnailPath)` - Add metadata entry
- `deleteScreenshot(id)` - Remove metadata entry

#### TrayManager.js
**Purpose**: System tray icon and menu

**Key Methods**:
- `create()` - Initialize tray icon
- `setToolTip(text)` - Update tray tooltip
- `destroy()` - Clean up tray icon

#### KeyboardShortcuts.js
**Purpose**: Global keyboard shortcut registration

**Key Methods**:
- `register(accelerator, callback, name)` - Register a single shortcut
- `registerAll(shortcuts)` - Register multiple shortcuts
- `unregisterAll()` - Clean up all shortcuts

### Utility Modules (`src/utils/`)

#### logger.js
Centralized logging with context prefixes

```javascript
const { createLogger } = require('./src/utils/logger');
const logger = createLogger('MyModule');

logger.info('Information message');
logger.error('Error occurred', error);
logger.debug('Debug info'); // Only in dev mode
logger.start('OperationName'); // Log operation start
logger.success('OperationName'); // Log operation success
```

#### paths.js
Path resolution with fallback support

```javascript
const { getScreenshotsPath, generateScreenshotFilename } = require('./src/utils/paths');

// Get writable screenshots directory
const dir = getScreenshotsPath();

// Generate unique filename
const filename = generateScreenshotFilename();
```

#### imageHelpers.js
Image processing utilities

```javascript
const { toNativeImage, toDataUrl, cropImage, createThumbnail } = require('./src/utils/imageHelpers');

// Convert between formats
const nativeImg = toNativeImage(buffer);
const dataUrl = toDataUrl(buffer);

// Process images
const cropped = cropImage(image, bounds);
const thumb = createThumbnail(image, 200);
```

### Renderer Process Scripts (`renderer/`)

#### selection.js
Handles area selection UI

**Class**: `SelectionController`
- Manages mouse drag selection
- Visual feedback during selection
- Sends coordinates to main process

#### preview.js
Handles screenshot annotation

**Class**: `AnnotationController`
- Drawing tools: rectangle, arrow, text, highlight
- Undo/clear functionality
- Save and copy operations

#### gallery.js
Handles screenshot gallery

**Class**: `GalleryController`
- Displays screenshot thumbnails
- Search and filter functionality
- Delete and copy operations
- Preview modal

## Key Design Principles

### Separation of Concerns
- **Main Process**: OS-level operations (windows, screen capture, file system)
- **Renderer Process**: UI interactions and display
- **Clear IPC boundaries**: Communication through defined message channels

### Single Responsibility
Each module has one clear purpose:
- `WindowManager` only manages windows
- `ScreenshotCapture` only captures screens
- `StorageManager` only handles file operations

### Dependency Injection
Managers receive dependencies via constructor options:

```javascript
const tray = new TrayManager({
  iconPath: '/path/to/icon.png',
  onTakeScreenshot: () => app.startSelection(),
  onCaptureFullScreen: () => app.captureFullScreen(),
  onOpenGallery: () => app.windowManager.createGalleryWindow(),
  onQuit: () => app.quit()
});
```

### Error Handling
- Centralized logging through `logger.js`
- Try-catch blocks in all async operations
- Graceful fallbacks for file operations

## IPC Communication Flow

```
Renderer Process          Main Process
     │                         │
     │──area-screenshot──────>│
     │                         │──> WindowManager.createSelectionWindow()
     │                         │
     │<─load selection.html───│
     │                         │
     │──selection-complete───>│
     │                         │──> ScreenshotCapture.captureArea()
     │                         │──> WindowManager.createPreviewWindow()
     │                         │
     │<─load-image (dataURL)──│
     │                         │
     │──save-screenshot──────>│
     │                         │──> StorageManager.saveScreenshot()
     │<─save-complete─────────│
```

## Adding New Features

### Adding a New Drawing Tool

1. Add tool button to `preview.html`
2. Add tool to `toolButtons` in `renderer/preview.js`
3. Implement drawing logic in `_drawAnnotation()`
4. Handle tool in `_redrawCanvas()`

### Adding a New Keyboard Shortcut

1. Add to shortcuts array in `main.js`:
```javascript
{
  accelerator: 'CommandOrControl+Shift+N',
  name: 'New feature',
  callback: () => { /* your action */ }
}
```

### Adding a New Window Type

1. Create HTML template in root
2. Create renderer controller in `renderer/`
3. Add method to `WindowManager.js`
4. Set up IPC handler in `main.js`

## Development Guidelines

1. **Always use the logger** for consistent logging
2. **Keep methods focused** - each method should do one thing well
3. **Document purpose** with JSDoc comments
4. **Use async/await** for asynchronous operations
5. **Validate inputs** before processing
6. **Handle errors** gracefully with try-catch
7. **Separate view from controller** - HTML is template, JS is logic

## Testing

Run in development mode for detailed logging:
```bash
npm run dev
```

Logs will show:
- `[WindowManager]` - Window operations
- `[ScreenshotCapture]` - Screen capture
- `[StorageManager]` - File operations
- `[TrayManager]` - Tray events
- `[KeyboardShortcuts]` - Shortcut registration
