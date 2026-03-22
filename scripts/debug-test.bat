@echo off
echo ========================================
echo Screenshot App Debug Test Script
echo ========================================
echo.
echo This script will start the Electron app with debugging enabled.
echo.
echo TESTING INSTRUCTIONS:
echo 1. When the app starts, try the following:
echo    - Click "Select Area" button
echo    - Drag to select an area
echo    - Release mouse
echo    - Check if preview window appears
echo.
echo 2. For fullscreen capture:
echo    - Click "Capture Full Screen" button
echo    - Check if preview window appears
echo.
echo 3. Watch this console for debug messages
echo.
echo ========================================
echo Starting application...
echo ========================================
echo.

cd /d "%~dp0"
node --inspect-brk node_modules/electron/cli.js . 2>&1

pause
