# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MauShot - Screenshot & Annotation App

Electron desktop app for capturing, annotating, and managing screenshots on Windows.

**Key dependencies:** `electron ^28`, `electron-store ^8.1` (metadata persistence), `jimp ^0.22` (image processing/thumbnails)

## Development Commands

```bash
npm start          # Launch app
npm run dev        # Launch with verbose debug logging (--dev flag)
run-as-admin.bat   # Launch with admin privileges (Windows, needed for some capture scenarios)
```

No test runner is configured — the `tests/` directory contains manual/utility scripts.

## Architecture

The app follows a strict **main process / renderer process** split required by Electron:

- **Main process** (`main.js` + `src/`) — Node.js, has OS access (file system, screen capture, shortcuts)
- **Renderer processes** (`renderer/*.js`) — browser context, no direct Node access, communicates via IPC

### Data flow for area screenshot
1. User triggers shortcut → `KeyboardShortcuts` fires → `main.js` calls `windowManager.createSelectionWindow()`
2. `selection.html` + `renderer/selection.js` render full-screen overlay for drag selection
3. On completion → `ipcRenderer.send('selection-complete', bounds)` → `main.js` handler
4. `ScreenshotCapture.captureArea(bounds)` → captured image buffer returned
5. `windowManager.createPreviewWindow(image, bounds, filePath)` opens annotation editor
6. User annotates → `ipcRenderer.send('save-screenshot', data)` → `StorageManager.saveScreenshot()`

### IPC channels (renderer → main)
| Channel | Payload | Description |
|---------|---------|-------------|
| `selection-complete` | `{x, y, width, height, absoluteCoords}` | Area selected |
| `save-screenshot` | `{imageData, filename}` | Save annotated image |
| `get-screenshots` | — | Request gallery list |
| `delete-screenshot` | `{id}` | Delete by ID |
| `copy-to-clipboard` | `{imageData}` | Copy to clipboard |

All IPC handlers are registered in `_setupIpcHandlers()` in `main.js`. Main → renderer replies use `event.reply()` or `webContents.send()`.

### Annotation tools (preview window)
Tools in `renderer/preview.js`: `select`, `rect`, `arrow`, `text`, `highlight`, `blur`. Each annotation is stored as an object in `this.annotations[]`. The canvas is fully redrawn on every change via `_redrawCanvas()`, which replays all annotations over `this.originalImageData`. Blur uses an offscreen `workingCanvas`.

### Window lifecycle
Windows are created fresh each time (not reused). The app stays alive in the system tray when all windows are closed — `windowManager` suppresses the default quit-on-close behavior.

## Logging

Always use the centralized logger — **never `console.log`** in main process or `src/` modules:

```javascript
const { createLogger } = require('./src/utils/logger');
const logger = createLogger('ModuleName');
logger.info('msg') / logger.error('msg', err) / logger.start('op') / logger.success('op')
```

Debug logs only appear when launched with `--dev`. Renderer scripts currently use `console.log` directly.

## Key Conventions

- Private methods prefixed with `_` (e.g. `_setupIpcHandlers`)
- Managers receive config via constructor options object (dependency injection pattern)
- Screenshots saved to `%USERPROFILE%\Pictures\Screenshots\` — see `src/utils/paths.js`
- Filename format: `screenshot-YYYY-MM-DD-HHMMSS.png`; thumbnails auto-generated at 200px width via `jimp`
- Global shortcuts: `Ctrl+Shift+A` (area), `Ctrl+Shift+F` (full screen), `Ctrl+Shift+G` (gallery)
