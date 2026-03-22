/**
 * logger.js - Centralized logging utility
 *
 * Provides consistent logging throughout the application with
 * context prefixes and different log levels.
 */

class Logger {
  /**
   * Create a logger with a specific context prefix
   * @param {string} context - Prefix to identify the log source (e.g., 'WindowManager', 'ScreenshotCapture')
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Log general information messages
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  info(message, ...args) {
    console.log(`[${this.context}]`, message, ...args);
  }

  /**
   * Log error messages
   * @param {string} message - The error message
   * @param {Error|any} error - The error object or additional data
   * @param {...any} args - Additional arguments to log
   */
  error(message, error, ...args) {
    console.error(`[${this.context}] ERROR:`, message, error, ...args);
    if (error instanceof Error && error.stack) {
      console.error(`[${this.context}] Stack trace:`, error.stack);
    }
  }

  /**
   * Log warning messages
   * @param {string} message - The warning message
   * @param {...any} args - Additional arguments to log
   */
  warn(message, ...args) {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  /**
   * Log debug messages (only in development mode)
   * @param {string} message - The debug message
   * @param {...any} args - Additional arguments to log
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV === 'dev' || process.argv.includes('--dev')) {
      console.log(`[${this.context}] DEBUG:`, message, ...args);
    }
  }

  /**
   * Log the start of a function/operation
   * @param {string} operation - Name of the operation starting
   */
  start(operation) {
    this.debug(`=== ${operation} START ===`);
  }

  /**
   * Log the successful completion of a function/operation
   * @param {string} operation - Name of the operation completed
   */
  success(operation) {
    this.debug(`=== ${operation} SUCCESS ===`);
  }

  /**
   * Log the failure of a function/operation
   * @param {string} operation - Name of the operation that failed
   * @param {Error|string} error - The error that occurred
   */
  fail(operation, error) {
    this.error(`=== ${operation} FAILED ===`, error);
  }
}

/**
 * Factory function to create loggers with specific contexts
 * @param {string} context - The context prefix for the logger
 * @returns {Logger} A new logger instance with the given context
 */
function createLogger(context) {
  return new Logger(context);
}

module.exports = { createLogger, Logger };
