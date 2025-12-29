/**
 * Browser Lifecycle Management 
 *
 * Handles Puppeteer browser initialization with:
 * - Anti-detection measures for stealth browsing
 * - human like behavior emulation
 * - Resource optimization a puppeteer instance
 */

import puppeteer from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { logger } from "../utils/logger.js"
import { USER_AGENTS } from "../config/constants.js"
//stealth mode
puppeteer.use(StealthPlugin())

export class BrowserManager {
  constructor(config) {
    this.config = config
    this.browser = null
    this.page = null
  }

  async launch() {
    logger.info("Launching browser.......")

    const launchOptions = {
      headless: this.config.headless ? "new" : false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: {
        width: this.config.viewportWidth,
        height: this.config.viewportHeight,
      },
    }

    this.browser = await puppeteer.launch(launchOptions)
    const pages = await this.browser.pages()
    this.page = pages[0] || (await this.browser.newPage())


    const userAgent = this.config.userAgent || this.getRandomUserAgent()
    await this.page.setUserAgent(userAgent)
//add security 
    await this.applyAntiDetection()

    logger.info("Browser launched successfully....")
    return { browser: this.browser, page: this.page }
  }

  async applyAntiDetection() {
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      })
    })

    await this.page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
    })

    await this.page.evaluateOnNewDocument(() => {
      window.chrome = {
        runtime: {},
      }
    })

    logger.debug("Anti-detection measures applied..")
  }

  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      logger.info("Browser closed")
    }
  }
}
