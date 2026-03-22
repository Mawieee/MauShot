#!/bin/bash

echo "========================================"
echo "Verifying Area Selection Fix"
echo "========================================"
echo ""

echo "Checking main.js for fix markers..."
echo ""

echo "[1/4] Checking for async selection-complete handler..."
if grep -q "ipcMain.on('selection-complete', async" main.js; then
    echo "OK: selection-complete handler is async"
else
    echo "FAIL: selection-complete handler is not async"
fi

echo ""
echo "[2/4] Checking for selection window hide before capture..."
if grep -q "selectionWindow.hide()" main.js; then
    echo "OK: Selection window is hidden before capture"
else
    echo "FAIL: Selection window hide not found"
fi

echo ""
echo "[3/4] Checking for display resolution thumbnail size..."
if grep -q "width: targetDisplay.bounds.width" main.js; then
    echo "OK: Using display resolution for thumbnail"
else
    echo "FAIL: Not using display resolution"
fi

echo ""
echo "[4/4] Checking for direct crop without scaling..."
if grep -q "fullImage.crop" main.js; then
    echo "OK: Using direct crop"
else
    echo "FAIL: Direct crop not found"
fi

echo ""
echo "========================================"
echo "Checking selection.html for fix markers..."
echo "========================================"
echo ""

echo "[1/2] Checking for getDisplayNearestPoint usage..."
if grep -q "getDisplayNearestPoint" selection.html; then
    echo "OK: Using getDisplayNearestPoint for display detection"
else
    echo "FAIL: getDisplayNearestPoint not found"
fi

echo ""
echo "[2/2] Checking for debug logging..."
if grep -q "=== VALID SELECTION BLOCK START ===" selection.html; then
    echo "OK: Debug logging present"
else
    echo "FAIL: Debug logging not found"
fi

echo ""
echo "========================================"
echo "Checking preview.html for fix markers..."
echo "========================================"
echo ""

echo "[1/2] Checking for image error handler..."
if grep -q "img.onerror" preview.html; then
    echo "OK: Image error handler present"
else
    echo "FAIL: Image error handler not found"
fi

echo ""
echo "[2/2] Checking for debug logging..."
if grep -q "=== LOAD IMAGE START ===" preview.html; then
    echo "OK: Debug logging present"
else
    echo "FAIL: Debug logging not found"
fi

echo ""
echo "========================================"
echo "Syntax checking..."
echo "========================================"
echo ""

echo "[1/3] Checking main.js syntax..."
if node -c main.js 2>/dev/null; then
    echo "OK: main.js has valid syntax"
else
    echo "FAIL: main.js has syntax errors"
fi

echo ""
echo "========================================"
echo "Verification Complete"
echo "========================================"
echo ""
echo "If all checks passed, the fix is properly applied."
echo "Run the application to test the fix."
echo ""
