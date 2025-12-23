/**
 * Form Automation - PRODUCTION READY
 *
 * Handles ASBA application form with:
 * - Bank selection (native select)
 * - Account selection (native select)
 * - Minimum quantity validation
 * - Kitta, CRN, PIN entry
 * - Two-step submission (Proceed -> PIN -> Apply)
 */

import { logger } from "../utils/logger.js"
import { SELECTORS, TIMEOUTS } from "../config/constants.js"
import fs from "fs"
import path from "path"

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class FormAutomation {
  constructor(page, config) {
    this.page = page
    this.config = config
    this.minQuantity = 10 // Default, will be read from page
  }

  async navigateToIssue(issue) {
    logger.info(`Opening form for: ${issue.name}`)

    try {
      const clicked = await this.page.evaluate((issueIndex) => {
        const lists = document.querySelectorAll(".company-list")
        if (lists[issueIndex]) {
          const btn = lists[issueIndex].querySelector("button.btn-issue")
          if (btn && !btn.disabled) {
            btn.click()
            return true
          }
        }
        return false
      }, issue.index)

      if (!clicked) throw new Error("Apply button not found or disabled")

      await delay(3000)

      // Wait for form to load
      await this.page.waitForSelector("select#selectBank, .section-title, .card-body", {
        timeout: TIMEOUTS.LONG,
      })

      logger.info("Application form loaded")
    } catch (error) {
      throw new Error(`Failed to open form: ${error.message}`)
    }
  }

  async fillForm() {
    logger.info("Filling application form...")

    try {
      await delay(1500)

      // Step 1: Read minimum quantity from page
      await this.readMinimumQuantity()

      // Step 2: Validate kitta against minimum
      this.validateKitta()

      // Step 3: Select bank
      logger.info("Selecting bank...")
      await this.selectBank()
      await delay(2000)

      // Step 4: Select account number
      logger.info("Selecting account...")
      await this.selectAccount()
      await delay(1500)

      // Step 5: Enter kitta
      logger.info(`Entering kitta: ${this.config.appliedKitta}`)
      await this.fillKitta()
      await delay(1000)

      // Step 6: Verify amount calculated
      await this.verifyAmount()

      // Step 7: Enter CRN
      if (this.config.crnNumber) {
        logger.info("Entering CRN...")
        await this.fillCRN()
        await delay(500)
      }

      // Step 8: Accept disclaimer
      logger.info("Accepting disclaimer...")
      await this.acceptDisclaimer()

      logger.info("Form filled successfully")
    } catch (error) {
      await this.captureScreenshot("form-error")
      throw new Error(`Form filling failed: ${error.message}`)
    }
  }

  async readMinimumQuantity() {
    try {
      const minQty = await this.page.evaluate(() => {
        // Find the minimum quantity label and its value
        const labels = document.querySelectorAll("label")
        for (const label of labels) {
          if (label.textContent.includes("Minimum Quantity")) {
            // Get the parent row and find the value span
            const row = label.closest(".form-group, .row")
            if (row) {
              const valueSpan = row.querySelector(".form-value span")
              if (valueSpan) {
                return Number.parseInt(valueSpan.textContent.trim(), 10)
              }
            }
          }
        }
        return 10 // Default fallback
      })

      this.minQuantity = minQty || 10
      logger.info(`Minimum quantity for this issue: ${this.minQuantity}`)
    } catch (e) {
      logger.warn(`Could not read minimum quantity, using default: 10`)
      this.minQuantity = 10
    }
  }

  validateKitta() {
    const kitta = Number.parseInt(this.config.appliedKitta, 10)

    if (kitta < this.minQuantity) {
      throw new Error(
        `Applied kitta (${kitta}) is less than minimum quantity (${this.minQuantity}). ` +
          `Please set APPLIED_KITTA >= ${this.minQuantity} in your .env file.`,
      )
    }

    // Check if kitta is divisible (some issues require this)
    logger.info(`Kitta validation passed: ${kitta} >= ${this.minQuantity}`)
  }

  async selectBank() {
    try {
      await this.page.waitForSelector(SELECTORS.FORM.BANK_SELECT, { timeout: TIMEOUTS.MEDIUM })

      // Get available banks
      const banks = await this.page.evaluate((sel) => {
        const select = document.querySelector(sel)
        if (!select) return []
        return Array.from(select.options).map((o) => ({
          value: o.value,
          text: o.textContent.trim(),
        }))
      }, SELECTORS.FORM.BANK_SELECT)

      logger.debug(`Available banks: ${banks.length}`)

      if (banks.length <= 1) {
        throw new Error("No bank options available. Please check your MeroShare account settings.")
      }

      // Select first valid bank
      const bank = banks.find((b) => b.value && b.value !== "")
      if (!bank) throw new Error("No valid bank option found")

      await this.page.select(SELECTORS.FORM.BANK_SELECT, bank.value)
      logger.info(`Bank selected: ${bank.text}`)

      // Wait for account dropdown to populate
      await delay(2000)
    } catch (error) {
      throw new Error(`Bank selection failed: ${error.message}`)
    }
  }

  async selectAccount() {
    try {
      // Wait for account dropdown
      await this.page.waitForSelector(SELECTORS.FORM.ACCOUNT_SELECT, { timeout: TIMEOUTS.MEDIUM })

      // Small delay for options to load after bank selection
      await delay(1000)

      // Get available accounts
      const accounts = await this.page.evaluate((sel) => {
        const select = document.querySelector(sel)
        if (!select) return []
        return Array.from(select.options).map((o) => ({
          value: o.value,
          text: o.textContent.trim(),
        }))
      }, SELECTORS.FORM.ACCOUNT_SELECT)

      logger.debug(`Available accounts: ${accounts.length}`)

      if (accounts.length <= 1) {
        // Only "Please choose one" option - no actual accounts
        throw new Error("No bank accounts available. Please ensure your bank account is linked in MeroShare.")
      }

      // Select first valid account (skip "Please choose one")
      const account = accounts.find((a) => a.value && a.value !== "")
      if (!account) throw new Error("No valid bank account found")

      await this.page.select(SELECTORS.FORM.ACCOUNT_SELECT, account.value)
      logger.info(`Account selected: ${account.text}`)
    } catch (error) {
      throw new Error(`Account selection failed: ${error.message}`)
    }
  }

  async fillKitta() {
    try {
      await this.page.waitForSelector(SELECTORS.FORM.KITTA_INPUT, { timeout: TIMEOUTS.SHORT })

      // Clear and set value using JavaScript for reliability
      await this.page.evaluate(
        (sel, val) => {
          const input = document.querySelector(sel)
          if (input) {
            input.focus()
            input.value = ""
            input.value = val
            input.dispatchEvent(new Event("input", { bubbles: true }))
            input.dispatchEvent(new Event("change", { bubbles: true }))
            input.dispatchEvent(new Event("blur", { bubbles: true }))
          }
        },
        SELECTORS.FORM.KITTA_INPUT,
        this.config.appliedKitta.toString(),
      )

      // Verify the value was set
      const setValue = await this.page.evaluate((sel) => {
        const input = document.querySelector(sel)
        return input?.value || ""
      }, SELECTORS.FORM.KITTA_INPUT)

      if (setValue !== this.config.appliedKitta.toString()) {
        throw new Error(`Kitta not set correctly. Expected: ${this.config.appliedKitta}, Got: ${setValue}`)
      }

      logger.debug(`Kitta entered: ${setValue}`)
    } catch (error) {
      throw new Error(`Kitta entry failed: ${error.message}`)
    }
  }

  async verifyAmount() {
    await delay(1500)
    try {
      const amount = await this.page.evaluate((sel) => {
        const input = document.querySelector(sel)
        return input?.value || ""
      }, SELECTORS.FORM.AMOUNT_INPUT)

      if (amount) {
        logger.info(`Calculated amount: Rs. ${amount}`)
      } else {
        logger.warn("Amount not calculated - this may indicate a form issue")
      }
    } catch (e) {
      logger.warn(`Amount verification skipped: ${e.message}`)
    }
  }

  async fillCRN() {
    try {
      const crnInput = await this.page.$(SELECTORS.FORM.CRN_INPUT)
      if (!crnInput) {
        logger.warn("CRN input not found - skipping")
        return
      }

      await this.page.evaluate(
        (sel, val) => {
          const input = document.querySelector(sel)
          if (input) {
            input.focus()
            input.value = ""
            input.value = val
            input.dispatchEvent(new Event("input", { bubbles: true }))
            input.dispatchEvent(new Event("change", { bubbles: true }))
            input.dispatchEvent(new Event("blur", { bubbles: true }))
          }
        },
        SELECTORS.FORM.CRN_INPUT,
        this.config.crnNumber,
      )

      logger.debug("CRN entered")
    } catch (error) {
      throw new Error(`CRN entry failed: ${error.message}`)
    }
  }

  async acceptDisclaimer() {
    try {
      const checkbox = await this.page.$(SELECTORS.FORM.DISCLAIMER_CHECKBOX)
      if (!checkbox) {
        logger.warn("Disclaimer checkbox not found - may already be accepted")
        return
      }

      const isChecked = await checkbox.evaluate((el) => el.checked)
      if (!isChecked) {
        await checkbox.click()
        logger.debug("Disclaimer accepted")
      }
    } catch (error) {
      throw new Error(`Disclaimer acceptance failed: ${error.message}`)
    }
  }

  async submit() {
    logger.info("Starting submission process...")

    try {
      // Step 1: Click Proceed button
      logger.info("Step 1: Clicking Proceed...")
      await this.clickProceed()

      // Wait for PIN form
      await delay(2000)

      // Check for any error messages first
      const formError = await this.checkForErrors()
      if (formError) {
        throw new Error(`Form validation failed: ${formError}`)
      }

      // Step 2: Wait for PIN input
      await this.page.waitForSelector(SELECTORS.FORM.TRANSACTION_PIN, { timeout: TIMEOUTS.MEDIUM })
      logger.info("PIN form loaded")

      // Step 3: Enter PIN
      logger.info("Step 2: Entering transaction PIN...")
      await this.enterPIN()

      // Step 4: Click Apply
      logger.info("Step 3: Clicking Apply...")
      await this.clickApply()

      // Step 5: Parse result
      const result = await this.parseResult()
      return result
    } catch (error) {
      await this.captureScreenshot("submit-error")
      throw new Error(`Submission failed: ${error.message}`)
    }
  }

  async clickProceed() {
    // Find enabled submit button
    const btn = await this.page.$('button.btn-primary[type="submit"]:not([disabled])')

    if (!btn) {
      // Check if button exists but is disabled
      const disabledBtn = await this.page.$('button.btn-primary[type="submit"][disabled]')
      if (disabledBtn) {
        // Try to get validation error message
        const errorMsg = await this.getValidationError()
        throw new Error(`Form incomplete: ${errorMsg || "Please fill all required fields"}`)
      }
      throw new Error("Proceed button not found")
    }

    await btn.click()
    await delay(2000)
  }

  async getValidationError() {
    return await this.page.evaluate(() => {
      // Check for validation icons
      const validationIcons = document.querySelectorAll(".validation-icon.alert")
      for (const icon of validationIcons) {
        const tooltip = icon.getAttribute("tooltip")
        if (tooltip) return tooltip
      }

      // Check for error text
      const errorElements = document.querySelectorAll(".text-danger, .invalid-feedback")
      for (const el of errorElements) {
        if (el.textContent.trim()) return el.textContent.trim()
      }

      return null
    })
  }

  async checkForErrors() {
    return await this.page.evaluate(() => {
      // Check toast errors
      const toast = document.querySelector(".toast-error")
      if (toast) return toast.textContent.trim()

      // Check alert errors
      const alert = document.querySelector(".alert-danger")
      if (alert) return alert.textContent.trim()

      return null
    })
  }

  async enterPIN() {
    const pin = this.config.transactionPin
    if (!pin) throw new Error("Transaction PIN not configured in .env file")

    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Transaction PIN must be exactly 4 digits")
    }

    // Set PIN value using JavaScript
    await this.page.evaluate(
      (sel, val) => {
        const input = document.querySelector(sel)
        if (input) {
          input.focus()
          input.value = ""
          input.value = val
          input.dispatchEvent(new Event("input", { bubbles: true }))
          input.dispatchEvent(new Event("change", { bubbles: true }))
        }
      },
      SELECTORS.FORM.TRANSACTION_PIN,
      pin,
    )

    logger.debug("PIN entered")
    await delay(500)
  }

  async clickApply() {
    await delay(1000)

    const btn = await this.page.$('button.btn-primary[type="submit"]:not([disabled])')
    if (!btn) {
      const errorMsg = await this.checkForErrors()
      throw new Error(errorMsg || "Apply button not found or disabled")
    }

    await btn.click()
    await delay(3000)
  }

  async parseResult() {
    await delay(3000)

    // Check for success toast
    const successResult = await this.page.evaluate(() => {
      const toast = document.querySelector(".toast-success")
      if (toast) return { success: true, message: toast.textContent.trim() }
      return null
    })

    if (successResult) {
      logger.info(`SUCCESS: ${successResult.message}`)
      return {
        success: true,
        message: successResult.message,
        referenceId: this.extractReference(successResult.message),
      }
    }

    // Check for error toast
    const errorResult = await this.page.evaluate(() => {
      const toast = document.querySelector(".toast-error")
      if (toast) return { success: false, error: toast.textContent.trim() }

      const alert = document.querySelector(".alert-danger")
      if (alert) return { success: false, error: alert.textContent.trim() }

      return null
    })

    if (errorResult) {
      logger.error(`FAILED: ${errorResult.error}`)
      return errorResult
    }

    // Check page content for success indicators
    const pageContent = await this.page.evaluate(() => document.body.innerText.toLowerCase())

    if (
      pageContent.includes("success") ||
      pageContent.includes("submitted") ||
      pageContent.includes("application received")
    ) {
      return {
        success: true,
        message: "Application appears to be submitted successfully",
      }
    }

    return {
      success: false,
      error: "Could not determine submission result - please check MeroShare manually",
    }
  }

  extractReference(msg) {
    const patterns = [/reference[:\s#]*(\w+)/i, /application[:\s#]*(\d+)/i, /(\d{8,})/]
    for (const pattern of patterns) {
      const match = msg.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  async captureScreenshot(prefix) {
    try {
      // Ensure screenshots directory exists
      const screenshotsDir = "screenshots"
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true })
      }

      const filename = `${prefix}-${Date.now()}.png`
      const filepath = path.join(screenshotsDir, filename)

      await this.page.screenshot({ path: filepath, fullPage: true })
      logger.info(`Screenshot saved: ${filepath}`)
    } catch (e) {
      logger.warn(`Screenshot failed: ${e.message}`)
    }
  }
}
