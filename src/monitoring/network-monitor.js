/**
 * Network Monitor
 *
 * Intercepts and records network requests/responses
 */

import { logger } from "../utils/logger.js"

export class NetworkMonitor {
  constructor(page) {
    this.page = page
    this.requests = []
    this.responses = []
    this.isMonitoring = false
  }

  async start() {
    logger.info("Starting network monitoring...")

    // Enable request interception
    await this.page.setRequestInterception(false)

    // Monitor requests
    this.page.on("request", (request) => {
      if (this.isMonitoring) {
        this.requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Monitor responses
    this.page.on("response", async (response) => {
      if (this.isMonitoring) {
        try {
          let data = null
          const contentType = response.headers()["content-type"]

          if (contentType && contentType.includes("application/json")) {
            data = await response.json()
          }

          this.responses.push({
            url: response.url(),
            status: response.status(),
            headers: response.headers(),
            data,
            timestamp: new Date().toISOString(),
          })

          // Log important responses
          if (response.url().includes("apply") || response.url().includes("submit")) {
            logger.debug(`[v0] Network response captured: ${response.url()} - Status: ${response.status()}`)
          }
        } catch (error) {
          // Ignore errors parsing response body
        }
      }
    })

    this.isMonitoring = true
    logger.info("✅ Network monitoring active")
  }

  stop() {
    this.isMonitoring = false
    logger.info("Network monitoring stopped")
  }

  getRequests() {
    return this.requests
  }

  getResponses() {
    return this.responses
  }

  clearHistory() {
    this.requests = []
    this.responses = []
  }
}
