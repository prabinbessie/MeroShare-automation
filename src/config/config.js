/**
 * Configuration Loader and Validator
 *
 * Supports SINGLE account and MULTI-account modes
 * 
 * Multi-account: ACCOUNTS as JSON array in .env file
 */

import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { logger } from "../utils/logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, "../../.env") })

class ConfigValidator {
  static validateAccount(account, index = 0) {
    const prefix = index > 0 ? `Account ${index}: ` : ""
    const required = ["username", "password", "dpName", "transactionPin"]

    const missing = required.filter((key) => !account[key])
    if (missing.length > 0) {
      throw new Error(`${prefix}Missing required fields: ${missing.join(", ")}`)
    }

    // Validate PIN format
    if (account.transactionPin && !/^\d{4}$/.test(account.transactionPin)) {
      throw new Error(`${prefix}Transaction PIN must be exactly 4 digits`)
    }

    // Validate kitta
    const kitta = Number.parseInt(account.appliedKitta)
    if (isNaN(kitta) || kitta <= 0) {
      throw new Error(`${prefix}Applied kitta must be a positive number`)
    }
  }

  static parseAccounts() {
    // Check for multi-account mode
    const accountsJson = process.env.ACCOUNTS
    if (accountsJson) {
      try {
        const accounts = JSON.parse(accountsJson)
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error("ACCOUNTS must be a non-empty JSON array")
        }
        return accounts.map((acc, i) => ({
          username: acc.username,
          password: acc.password,
          dpName: acc.dpName || acc.dp_name,
          crnNumber: acc.crnNumber || acc.crn || "",
          transactionPin: acc.transactionPin || acc.pin,
          appliedKitta: Number.parseInt(acc.appliedKitta || acc.kitta || "10"),
          targetIssueName: acc.targetIssueName || acc.issue || process.env.TARGET_ISSUE_NAME,
        }))
      } catch (e) {
        if (e.message.includes("JSON")) {
          throw new Error("ACCOUNTS must be valid JSON. Check your .env file.")
        }
        throw e
      }
    }

    // if single account 
    return [
      {
        username: process.env.MEROSHARE_USERNAME,
        password: process.env.MEROSHARE_PASSWORD,
        dpName: process.env.MEROSHARE_DP_NAME,
        crnNumber: process.env.CRN_NUMBER || "",
        transactionPin: process.env.TRANSACTION_PIN,
        appliedKitta: Number.parseInt(process.env.APPLIED_KITTA || "10"),
        targetIssueName: process.env.TARGET_ISSUE_NAME,
      },
    ]
  }
}
//for multiple accountss
const accounts = ConfigValidator.parseAccounts()
accounts.forEach((acc, i) => ConfigValidator.validateAccount(acc, accounts.length > 1 ? i + 1 : 0))
export const config = {
  accounts,
  username: accounts[0].username,
  password: accounts[0].password,
  dpName: accounts[0].dpName,
  crnNumber: accounts[0].crnNumber,
  transactionPin: accounts[0].transactionPin,
  appliedKitta: accounts[0].appliedKitta,
  targetIssueName: accounts[0].targetIssueName,
  headless: process.env.HEADLESS_MODE === "true",
  browserTimeout: Number.parseInt(process.env.BROWSER_TIMEOUT || "30000"),
  navigationTimeout: Number.parseInt(process.env.NAVIGATION_TIMEOUT || "60000"),
  screenshotOnError: process.env.SCREENSHOT_ON_ERROR !== "false",
  maxRetryAttempts: Number.parseInt(process.env.MAX_RETRY_ATTEMPTS || "3"),
  actionDelayMin: Number.parseInt(process.env.ACTION_DELAY_MIN || "500"),
  actionDelayMax: Number.parseInt(process.env.ACTION_DELAY_MAX || "2000"),

  maskSensitiveLogs: process.env.MASK_SENSITIVE_LOGS !== "false",
  logLevel: process.env.LOG_LEVEL || "info",
  notificationEnabled: process.env.NOTIFICATION_ENABLED === "true",
  notificationWebhook: process.env.NOTIFICATION_WEBHOOK_URL,
  notificationEmail: process.env.NOTIFICATION_EMAIL,
  userAgent: process.env.USER_AGENT || "",
  viewportWidth: Number.parseInt(process.env.VIEWPORT_WIDTH || "1920"),
  viewportHeight: Number.parseInt(process.env.VIEWPORT_HEIGHT || "1080"),
  networkIdleTimeout: Number.parseInt(process.env.NETWORK_IDLE_TIMEOUT || "2000"),
}

logger.info(`configuration loaded: ${accounts.length} account(s) configured sucees`)
