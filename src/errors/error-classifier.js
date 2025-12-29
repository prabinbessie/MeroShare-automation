/**
 * Error Classification Module
 *
 */

import { ERROR_CODES } from "../config/constants.js"

export class ErrorClassifier {
  static create(errorType, message, metadata = {}) {
    const errorConfig = ERROR_CODES[errorType]

    if (!errorConfig) {
      throw new Error(`Unknown error type: ${errorType}`)
    }

    const error = new Error(message)
    error.code = errorConfig.code
    error.category = errorConfig.category
    error.severity = errorConfig.severity
    error.retryable = errorConfig.retryable
    error.metadata = metadata
    error.timestamp = new Date().toISOString()

    return error
  }

  static isRetryable(error) {
    return error.retryable === true
  }

  static getCategory(error) {
    return error.category || "UNKNOWN"
  }

  static getSeverity(error) {
    return error.severity || "MEDIUM"
  }
}
