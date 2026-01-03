#!/usr/bin/env node
/**
 * MeroShare ASBA Automation 
 * By: Prabin Bhandari
 * Main Entry Point

 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function initializeDirectories() {
  const dirs = ["logs", "screenshots"]
  for (const dir of dirs) {
    const dirPath = path.resolve(process.cwd(), dir)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }
  const envPath = path.resolve(process.cwd(), ".env")
  const envExamplePath = path.resolve(__dirname, "../config/.env.example")

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log("Created .env file from template. Please configure your credentials.")
    process.exit(1)
  }
}

initializeDirectories()

//modules
import { config } from "./config/config.js"
import { logger } from "./utils/logger.js"
import { BrowserManager } from "./core/browser.js"
import { LoginHandler } from "./core/login.js"
import { IssueDetector } from "./core/issue-detector.js"
import { FormAutomation } from "./core/form-automation.js"
import { NetworkMonitor } from "./monitoring/network-monitor.js"
import { ErrorClassifier } from "./errors/error-classifier.js"
import { ErrorHandler } from "./errors/error-handler.js"
import { Notifier } from "./notifications/notifier.js"
import { ResultScraper } from "./core/result-scraper.js"

class MeroShareAutomation {
  constructor() {
    this.browserManager = null
    this.page = null
    this.networkMonitor = null
    this.results = []
  }

  async executeAll() {
    const totalAccounts = config.accounts.length

    //do we are in results mode?
    if (config.resultsMode) {
      return await this.executeResultsMode()
    }

    this.printHeader(totalAccounts)

    for (let i = 0; i < totalAccounts; i++) {
      const account = config.accounts[i]
      const label = totalAccounts > 1 ? `[Account ${i + 1}/${totalAccounts}]` : ""
      logger.info("")
      logger.info(`${label} Processing: ${this.maskValue(account.username)}`)
      logger.info(`${label} DP: ${account.dpName}`)
      logger.info(`${label} Target: ${account.targetIssueName}`)
      logger.info(`${label} Kitta: ${account.appliedKitta}`)

      try {
        const result = await this.executeForAccount(account, i + 1, totalAccounts)
        this.results.push({
          account: this.maskValue(account.username),
          dp: account.dpName,
          ...result,
        })

        if (result.success) {
          logger.info(`${label} SUCCESS: Application submitted!`)
          if (result.referenceId) {
            logger.info(`${label} Reference: ${result.referenceId}`)
          }
        } else {
          logger.error(`${label} FAILED: ${result.error}`)
        }
      } catch (error) {
        this.results.push({
          account: this.maskValue(account.username),
          dp: account.dpName,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
        logger.error(`${label} FAILED: ${error.message}`)
      }
      await this.cleanup()

      //delay between multiple accounts
      if (i < totalAccounts - 1) {
        logger.info(`${label} Waiting before next account...`)
        await this.delay(3000, 5000)
      }
    }

    this.printSummary()

    return this.results
  }

  printHeader(totalAccounts) {
    logger.info("================================================================")
    logger.info("  MEROSHARE ASBA AUTOMATION")
    logger.info("  BY PRABIN BHANDARI")
    logger.info("================================================================")
    logger.info(`  Mode: ${totalAccounts > 1 ? "MULTI-ACCOUNT" : "SINGLE ACCOUNT"}`)
    logger.info(`  Total Accounts: ${totalAccounts}`)
    logger.info(`  Headless: ${config.headless}`)
    logger.info(`  Screenshots: ${config.screenshotOnError ? "Enabled" : "Disabled"}`)
    logger.info("================================================================")
  }

  async executeForAccount(account, accountIndex, totalAccounts) {
    const label = totalAccounts > 1 ? `[${accountIndex}/${totalAccounts}]` : ""

    try {
      logger.info(`${label} Starting browser...`)
      this.browserManager = new BrowserManager(config)
      const { browser, page } = await this.browserManager.launch()
      this.page = page

      //network monitoring
      this.networkMonitor = new NetworkMonitor(page)
      await this.networkMonitor.start()
      logger.info(`${label} Browser ready`)

      //Login
      logger.info(`${label} Logging in...`)
      const loginHandler = new LoginHandler(page, account)
      await loginHandler.navigate()
      await loginHandler.login()
      logger.info(`${label} Login successful`)

      //Navigate to ASBA
      logger.info(`${label} Navigating to ASBA page...`)
      await this.navigateToASBA()
      logger.info(`${label} ASBA page loaded`)

      //Find target issue
      logger.info(`${label} Searching for: ${account.targetIssueName}`)
      const issueDetector = new IssueDetector(page, account)
      const targetIssue = await issueDetector.findTargetIssue()

      if (!targetIssue) {
        throw ErrorClassifier.create(
          "BUSINESS_LOGIC_ERROR",
          `Issue "${account.targetIssueName}" not found. Check if issue name is correct and issue is open`,
        )
      }

      if (!targetIssue.canApply) {
        throw ErrorClassifier.create(
          "BUSINESS_LOGIC_ERROR",
          `Issue "${targetIssue.name}" is not available for application (may be closed or already applied).`,
        )
      }
      logger.info(`${label} Found issue: ${targetIssue.name}`)
      logger.info(`${label} Filling application form...`)
      const formAutomation = new FormAutomation(page, account)
      await formAutomation.navigateToIssue(targetIssue)
      await formAutomation.fillForm()
      logger.info(`${label} Form filled`)
      logger.info(`${label} Submitting application...`)
      const result = await formAutomation.submit()
      return {
        success: result.success,
        message: result.message,
        error: result.error,
        referenceId: result.referenceId,
        timestamp: new Date().toISOString(),
        details: {
          issue: account.targetIssueName,
          kitta: account.appliedKitta,
          dp: account.dpName,
        },
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.page)
      throw error
    }
  }

  async navigateToASBA() {
    try {
      await this.page.goto("https://meroshare.cdsc.com.np/#/asba", {
        waitUntil: "networkidle2",
        timeout: config.navigationTimeout,
      })

      await this.page.waitForSelector("app-asba, .company-list, .page-title-wrapper", {
        timeout: config.browserTimeout,
      })

      await this.delay(2000)
    } catch (error) {
      throw new Error(`Failed to navigate to ASBA: ${error.message}`)
    }
  }

  printSummary() {
    const successful = this.results.filter((r) => r.success)
    const failed = this.results.filter((r) => !r.success)

    logger.info("")
    logger.info("================================================================")
    logger.info("  EXECUTION SUMMARY")
    logger.info("================================================================")
    logger.info(`  Total Processed: ${this.results.length}`)
    logger.info(`  Successful: ${successful.length}`)
    logger.info(`  Failed: ${failed.length}`)
    logger.info("----------------------------------------------------------------")

    this.results.forEach((result) => {
      const status = result.success ? "[OK]" : "[FAIL]"
      logger.info(`  ${status} ${result.account} (${result.dp})`)

      if (result.success) {
        if (result.referenceId) {
          logger.info(`        Reference: ${result.referenceId}`)
        }
        if (result.details) {
          logger.info(`        Issue: ${result.details.issue}, Kitta: ${result.details.kitta}`)
        }
      } else {
        logger.info(`        Error: ${result.error}`)
      }
    })

    logger.info("================================================================")
    if (config.notificationEnabled && this.results.length > 0) {
      this.sendNotifications()
    }
  }

  async sendNotifications() {
    try {
      const notifier = new Notifier(config)
      await notifier.sendBatch(this.results)
      logger.info("notification sent")
    } catch (e) {
      logger.warn(`failed to send notification: ${e.message}`)
    }
  }

  async cleanup() {
    if (this.networkMonitor) {
      this.networkMonitor.stop()
      this.networkMonitor = null
    }

    if (this.browserManager) {
      await this.browserManager.close()
      this.browserManager = null
    }

    this.page = null
  }

  maskValue(value) {
    if (!value || value.length < 4) return "***"
    return value.substring(0, 3) + "*".repeat(Math.min(value.length - 3, 5))
  }

  delay(min, max = min) {
    const ms = max > min ? Math.floor(Math.random() * (max - min + 1)) + min : min
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async executeResultsMode() {
    const totalAccounts = config.accounts.length

    logger.info("================================================================")
    logger.info("  RESULTS SCRAPING MODE")
    logger.info("  BY PRABIN BHANDARI")
    logger.info("================================================================")
    logger.info(`  Total Accounts: ${totalAccounts}`)
    logger.info("================================================================")

    for (let i = 0; i < totalAccounts; i++) {
      const account = config.accounts[i]
      const label = totalAccounts > 1 ? `[Account ${i + 1}/${totalAccounts}]` : ""

      logger.info("")
      logger.info(`${label} Scraping results for: ${this.maskValue(account.username)}`)
      logger.info(`${label} DP: ${account.dpName}`)

      try {
        logger.info(`${label} Starting browser...`)
        this.browserManager = new BrowserManager(config)
        const { browser, page } = await this.browserManager.launch()
        this.page = page
        logger.info(`${label} Browser ready`)
        logger.info(`${label} Logging in...`)
        const loginHandler = new LoginHandler(page, account)
        await loginHandler.navigate()
        await loginHandler.login()
        logger.info(`${label} Login successful`)
        const scraper = new ResultScraper(page, account)
        const result = await scraper.execute()

        this.results.push({
          account: this.maskValue(account.username),
          dp: account.dpName,
          ...result,
        })

        if (result.success) {
          logger.info(`${label} ✓ Successfully scraped ${result.results.length} application(s)`)
          if (result.changes) {
            const { newAllotments, updatedAllotments } = result.changes
            if (newAllotments.length > 0) {
              logger.info(`${label} 🎉 You have ${newAllotments.length} NEW allotment(s)!`)
            }
            if (updatedAllotments.length > 0) {
              logger.info(`${label} 📊 ${updatedAllotments.length} allotment(s) updated`)
            }
          }
        } else {
          logger.error(`${label} ✗ Failed to scrape results: ${result.error}`)
        }
      } catch (error) {
        this.results.push({
          account: this.maskValue(account.username),
          dp: account.dpName,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
        logger.error(`${label} ✗ Error: ${error.message}`)
      }

      await this.cleanup()
      if (i < totalAccounts - 1) {
        logger.info(`${label} Waiting before next account...`)
        await this.delay(2000, 3000)
      }
    }

    this.printResultsModeSummary()
    return this.results
  }

  printResultsModeSummary() {
    const successful = this.results.filter((r) => r.success)
    const failed = this.results.filter((r) => !r.success)

    logger.info("")
    logger.info("================================================================")
    logger.info("  RESULTS SCRAPING SUMMARY")
    logger.info("================================================================")
    logger.info(`  Total Accounts: ${this.results.length}`)
    logger.info(`  Successful: ${successful.length}`)
    logger.info(`  Failed: ${failed.length}`)
    logger.info("----------------------------------------------------------------")

    this.results.forEach((result) => {
      const status = result.success ? "[OK]" : "[FAIL]"
      logger.info(`  ${status} ${result.account} (${result.dp})`)

      if (result.success && result.summary) {
        logger.info(`        Total Applications: ${result.summary.total}`)
        logger.info(`        Alloted: ${result.summary.alloted}`)
        logger.info(`        Total Shares: ${result.summary.totalShares}`)

        if (result.changes) {
          if (result.changes.newAllotments.length > 0) {
            logger.info(`        🎉 NEW: ${result.changes.newAllotments.length} allotment(s)`)
          }
        }
      } else if (!result.success) {
        logger.info(`        Error: ${result.error}`)
      }
    })

    logger.info("================================================================")
    logger.info(`  Results saved in: logs/application-results.json`)
    logger.info("================================================================")
  }
}
;(async () => {
  const automation = new MeroShareAutomation()

  try {
    const results = await automation.executeAll()
    if (config.resultsMode) {
      const hasErrors = results.some((r) => !r.success)
      process.exit(hasErrors ? 1 : 0)
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    if (failCount === 0) {
      logger.info("")
      logger.info("All applications submitted successfully!")
      process.exit(0)
    } else if (successCount > 0) {
      logger.warn("")
      logger.warn(`${successCount} succeeded, ${failCount} failed. Check logs for details.`)
      process.exit(1)
    } else {
      logger.error("")
      logger.error("All applications failed. Check logs and screenshots for details.")
      process.exit(2)
    }
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`)
    await automation.cleanup()
    process.exit(2)
  }
})()
