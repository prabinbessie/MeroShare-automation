/**
 * Notification System
 *
 * Supports single and batch notifications for multi-account mode
 */

import axios from "axios"
import { logger } from "../utils/logger.js"
import { sanitize } from "../security/sanitizer.js"

export class Notifier {
  constructor(config) {
    this.config = config
  }

  async send(result) {
    if (!this.config.notificationEnabled) return

    try {
      const sanitizedResult = sanitize(result)
      const message = this.formatMessage(sanitizedResult)

      if (this.config.notificationWebhook) {
        await this.sendWebhook(message)
      }

      logger.info("Notification sent")
    } catch (error) {
      logger.error(`Notification failed: ${error.message}`)
    }
  }

  async sendBatch(results) {
    if (!this.config.notificationEnabled) return

    try {
      const successful = results.filter((r) => r.success)
      const failed = results.filter((r) => !r.success)

      const summary = {
        text: `MeroShare ASBA Automation Complete`,
        data: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          results: results.map((r) => ({
            account: r.account,
            status: r.success ? "SUCCESS" : "FAILED",
            referenceId: r.referenceId || null,
            error: r.error || null,
          })),
          timestamp: new Date().toISOString(),
        },
      }

      if (this.config.notificationWebhook) {
        await this.sendWebhook(summary)
      }

      logger.info("Batch notification sent")
    } catch (error) {
      logger.error(`Batch notification failed: ${error.message}`)
    }
  }

  async sendWebhook(message) {
    try {
      await axios.post(
        this.config.notificationWebhook,
        {
          text: message.text,
          data: message.data,
          timestamp: new Date().toISOString(),
        },
        { timeout: 10000 },
      )
    } catch (error) {
      throw new Error(`Webhook failed: ${error.message}`)
    }
  }

  formatMessage(result) {
    if (result.success) {
      return {
        text: "MeroShare ASBA Application Successful",
        data: {
          status: "SUCCESS",
          referenceId: result.referenceId || "N/A",
          message: result.message,
          timestamp: result.timestamp,
        },
      }
    } else {
      return {
        text: "MeroShare ASBA Application Failed",
        data: {
          status: "FAILED",
          error: result.error,
          timestamp: result.timestamp,
        },
      }
    }
  }
}
