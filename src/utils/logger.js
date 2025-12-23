/**
 * Structured Logger
 *
 * Winston-based logging with sensitive data masking
 * Ensures no credentials leak to console or files
 */

import winston from "winston"
import { existsSync, mkdirSync } from "fs"
import { sanitize } from "../security/sanitizer.js"

const { combine, timestamp, printf, colorize } = winston.format

// Ensure logs directory exists
const logsDir = "logs"
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true })
}

// Custom format with sanitization
const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`

  if (Object.keys(metadata).length > 0) {
    // Always sanitize metadata before logging
    const sanitizedMeta = sanitize(metadata)
    msg += ` ${JSON.stringify(sanitizedMeta)}`
  }

  return msg
})

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), customFormat),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      handleExceptions: true,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", { message: error.message, stack: error.stack })
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", { reason: String(reason) })
})
