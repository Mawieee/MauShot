@echo off
echo ========================================
echo Verifying Area Selection Fix
echo ========================================
echo.

echo Checking main.js for fix markers...
echo.

echo [1/4] Checking for async selection-complete handler...
findstr /C:"ipcMain.on('selection-complete', async" main.js >nul
if %errorlevel% equ 0 (
    echo OK: selection-complete handler is async
) else (
    echo FAIL: selection-complete handler is not async
)

echo.
echo [2/4] Checking for selection window hide before capture...
findstr /C:"selectionWindow.hide()" main.js >nul
if %errorlevel% equ 0 (
    echo OK: Selection window is hidden before capture
) else (
    echo FAIL: Selection window hide not found
)

echo.
echo [3/4] Checking for display resolution thumbnail size...
findstr /C:"width: targetDisplay.bounds.width" main.js >nul
if %errorlevel% equ 0 (
    echo OK: Using display resolution for thumbnail
) else (
    echo FAIL: Not using display resolution
)

echo.
echo [4/4] Checking for direct crop without scaling...
findstr /C:"fullImage.crop" main.js >nul
if %errorlevel% equ 0 (
    echo OK: Using direct crop
) else (
    echo FAIL: Direct crop not found
)

echo.
echo ========================================
echo Checking selection.html for fix markers...
echo ========================================
echo.

echo [1/2] Checking for getDisplayNearestPoint usage...
findstr /C:"getDisplayNearestPoint" selection.html >nul
if %errorlevel% equ 0 (
    echo OK: Using getDisplayNearestPoint for display detection
) else (
    echo FAIL: getDisplayNearestPoint not found
)

echo.
echo [2/2] Checking for debug logging...
findstr /C:"=== VALID SELECTION BLOCK START ===" selection.html >nul
if %errorlevel% equ 0 (
    echo OK: Debug logging present
) else (
    echo FAIL: Debug logging not found
)

echo.
echo ========================================
echo Checking preview.html for fix markers...
echo ========================================
echo.

echo [1/2] Checking for image error handler...
findstr /C:"img.onerror" preview.html >nul
if %errorlevel% equ 0 (
    echo OK: Image error handler present
) else (
    echo FAIL: Image error handler not found
)

echo.
echo [2/2] Checking for debug logging...
findstr /C:"=== LOAD IMAGE START ===" preview.html >nul
if %errorlevel% equ 0 (
    echo OK: Debug logging present
) else (
    echo FAIL: Debug logging not found
)

echo.
echo ========================================
echo Syntax checking...
echo ========================================
echo.

echo [1/3] Checking main.js syntax...
node -c main.js 2>nul
if %errorlevel% equ 0 (
    echo OK: main.js has valid syntax
) else (
    echo FAIL: main.js has syntax errors
)

echo.
echo ========================================
echo Verification Complete
echo ========================================
echo.
echo If all checks passed, the fix is properly applied.
echo Run the application to test the fix.
echo.
pause
