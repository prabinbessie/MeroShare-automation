/**
 * Global Error Handler
 *
 * Centralized error processing with screenshot capture
 */

import { logger } from "../utils/logger.js"
import { ErrorClassifier } from "./error-classifier.js"
import { captureScreenshot } from "../monitoring/screenshot.js"

export class ErrorHandler {
  static async handle(error, page = null) {
    // Log error with sanitization
    logger.error("Error occurred:", {
      message: error.message,
      code: error.code || "UNKNOWN",
      category: ErrorClassifier.getCategory(error),
      severity: ErrorClassifier.getSeverity(error),
      retryable: ErrorClassifier.isRetryable(error),
      stack: error.stack,
    })

    // Capture screenshot if page is available
    if (page) {
      try {
        await captureScreenshot(page, `error-${Date.now()}`)
      } catch (screenshotError) {
        logger.warn("Failed to capture error screenshot:", screenshotError.message)
      }
    }

    // Additional error-specific handling
    if (error.category === "Security Challenge") {
      logger.error("🛑 SECURITY CHALLENGE DETECTED")
      logger.error("Manual intervention required. Cannot proceed with automation.")
    }

    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        category: ErrorClassifier.getCategory(error),
        severity: ErrorClassifier.getSeverity(error),
        timestamp: new Date().toISOString(),
      },
    }
  }
}
