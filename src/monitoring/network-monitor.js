/**
 * Network Monitor
 *
 * intercepts and records network requests/responses from page
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

    //request interception 
    await this.page.setRequestInterception(false)

    //monitor requests 
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

    //monitor responses from page
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

          //log responses related to submission actions
          if (response.url().includes("apply") || response.url().includes("submit")) {
            logger.debug(`Network response captured: ${response.url()} - Status : ${response.status()}`)
          }
        } catch (error) {
          
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
