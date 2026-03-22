# Screenshot App - Lightshot Alternative

A desktop screenshot application built with Electron that allows you to capture, annotate, and manage screenshots.

## Features

### Core Features
- **Select Custom Area**: Click and drag to select a specific area of your screen
- **Full Screen Capture**: Capture your entire screen with one click
- **Instant Preview**: See your screenshot immediately after capture
- **Copy to Clipboard**: Quick copy to paste anywhere
- **Save to Local Storage**: Screenshots are saved to `Pictures/Screenshots` folder

### Annotation Tools
- **Rectangle**: Draw rectangles around areas of interest
- **Arrow**: Point to specific elements with arrows
- **Text**: Add text annotations
- **Highlight**: Highlight areas with semi-transparent markers
- **Color Picker**: Choose custom colors for annotations
- **Line Width**: Adjust thickness of drawing tools
- **Undo**: Undo last annotation
- **Clear All**: Remove all annotations

### Gallery
- **Grid Layout**: View all screenshots in a clean grid
- **Thumbnail Preview**: Quick preview of each screenshot
- **Full Preview**: Click to open full-size view
- **Copy to Clipboard**: Copy any saved screenshot back to clipboard
- **Delete Screenshots**: Remove unwanted screenshots
- **Search & Sort**: Find and organize your screenshots
- **Open in Editor**: Re-edit saved screenshots

### System Integration
- **System Tray**: Always accessible from system tray
- **Global Shortcuts**:
  - `Ctrl+Shift+A` - Select area to capture
  - `Ctrl+Shift+F` - Capture full screen
  - `Ctrl+Shift+G` - Open gallery

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the application:
   ```bash
   npm start
   ```

## Usage

### Taking Screenshots

1. **Area Selection**:
   - Click on the tray icon or press `Ctrl+Shift+A`
   - Click and drag to select the area you want to capture
   - Release mouse to capture, or press `Esc` to cancel

2. **Full Screen**:
   - Press `Ctrl+Shift+F` or select from tray menu

### Annotating Screenshots

After capturing, use the toolbar:
1. Select a tool (Rectangle, Arrow, Text, Highlight)
2. Choose color and line width
3. Draw on the screenshot
4. Use `Ctrl+Z` to undo if needed

### Saving & Copying

- **Copy to Clipboard**: Click the Copy button or press `Ctrl+C`
- **Save**: Click the Save button or press `Ctrl+S`
- Screenshots are automatically saved to `Pictures/Screenshots`

### Gallery Management

1. Open gallery from tray menu or press `Ctrl+Shift+G`
2. Browse your screenshots in grid view
3. Click to preview, or use action buttons to copy/delete
4. Use search and sort options to organize

## File Structure

```
screenshot-app/
├── main.js           # Main Electron process
├── index.html        # Main window
├── selection.html    # Area selection overlay
├── preview.html      # Screenshot preview with annotation tools
├── gallery.html      # Gallery management UI
├── package.json      # Project configuration
└── assets/
    ├── icon.png      # Tray icon
    └── icon.svg      # SVG icon source
```

## Screenshot Storage

- **Location**: `Pictures/Screenshots/`
- **Files**: Full-size PNG screenshots
- **Thumbnails**: 200px wide thumbnails (prefixed with `thumb_`)
- **Metadata**: `metadata.json` tracks all screenshots

## Keyboard Shortcuts

### Global Shortcuts
- `Ctrl+Shift+A` - Start area selection
- `Ctrl+Shift+F` - Capture full screen
- `Ctrl+Shift+G` - Open gallery

### In-App Shortcuts
- `Ctrl+C` - Copy to clipboard
- `Ctrl+S` - Save screenshot
- `Ctrl+Z` - Undo last annotation
- `Esc` - Close window/cancel selection
- `R` - Rectangle tool
- `A` - Arrow tool
- `T` - Text tool
- `H` - Highlight tool
- `V` - Select tool

## System Tray

The application runs in the system tray for quick access:
- Left-click tray icon - Start area selection
- Right-click tray icon - Show context menu with all options

## Development

### Project Structure

This is an Electron application with:
- **Main Process** (`main.js`): Handles native OS integration
- **Renderer Processes** (HTML files): UI for each window

### Key Technologies

- **Electron**: Desktop application framework
- **Node.js**: File system operations
- **HTML/CSS/JS**: User interface
- **Canvas API**: Screenshot annotation

## Requirements

- Node.js (v14 or higher)
- npm
- Windows 10/11, macOS, or Linux

## License

MIT
