/**
 * paths.js - Path resolution utilities
 *
 * Handles finding and creating appropriate directories for storing
 * screenshots and application data, with fallback mechanisms.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Get the screenshots folder path
 *
 * Uses the MauShot folder in home directory:
 * C:\Users\Username\MauShot
 *
 * @returns {string} The path to the screenshots directory
 */
function getScreenshotsPath() {
  // Use the MauShot folder in home directory (avoid OneDrive sync issues)
  const maushotPath = path.join(os.homedir(), 'MauShot');

  // Create the directory if it doesn't exist
  try {
    if (!fs.existsSync(maushotPath)) {
      fs.mkdirSync(maushotPath, { recursive: true });
    }
    return maushotPath;
  } catch (error) {
    // Fallback to AppData if MauShot path fails
    const fallbackPath = path.join(os.homedir(), 'AppData', 'Local', 'MauShot', 'Screenshots');
    if (!fs.existsSync(fallbackPath)) {
      fs.mkdirSync(fallbackPath, { recursive: true });
    }
    return fallbackPath;
  }
}

/**
 * Test if a path is writable
 *
 * Attempts to create the directory and write a test file to verify write access.
 *
 * @param {string} testPath - The path to test
 * @returns {boolean} True if the path is writable, false otherwise
 */
function tryPath(testPath) {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(testPath)) {
      fs.mkdirSync(testPath, { recursive: true });
    }

    // Test write access by creating and deleting a test file
    const testFile = path.join(testPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a unique filename for a screenshot
 *
 * Creates a filename with timestamp to avoid collisions.
 *
 * @returns {string} A filename in the format "Screenshot_YYYY-MM-DDTHH-mm-ss.png"
 */
function generateScreenshotFilename() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `Screenshot_${month}-${day}-${year}_${hours}-${minutes}-${seconds}.png`;
}

/**
 * Generate a thumbnail filename from a screenshot filename
 *
 * @param {string} screenshotFilename - The original screenshot filename
 * @returns {string} The thumbnail filename with "thumb_" prefix
 */
function generateThumbnailFilename(screenshotFilename) {
  return `thumb_${screenshotFilename}`;
}

/**
 * Get the full path for a new screenshot
 *
 * @param {string} [dirPath] - Optional directory path (defaults to getScreenshotsPath())
 * @returns {string} The full file path for the new screenshot
 */
function getScreenshotFilePath(dirPath) {
  const basePath = dirPath || getScreenshotsPath();
  return path.join(basePath, generateScreenshotFilename());
}

/**
 * Get the full path for a thumbnail
 *
 * @param {string} screenshotFilename - The screenshot filename
 * @param {string} [dirPath] - Optional directory path (defaults to getScreenshotsPath())
 * @returns {string} The full file path for the thumbnail
 */
function getThumbnailPath(screenshotFilename, dirPath) {
  const basePath = dirPath || getScreenshotsPath();
  return path.join(basePath, generateThumbnailFilename(screenshotFilename));
}

module.exports = {
  getScreenshotsPath,
  generateScreenshotFilename,
  generateThumbnailFilename,
  getScreenshotFilePath,
  getThumbnailPath
};
