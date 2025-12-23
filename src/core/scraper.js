/**
 * Depository Participant Scraper
 *
 * Scrapes bank list from ASBA application form
 * Based on actual MeroShare HTML structure
 */

import { logger } from "../utils/logger.js"
import { URLS, SELECTORS, TIMEOUTS } from "../config/constants.js"
import { delay } from "../utils/helpers.js"

export class DPScraper {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async scrapeAllBanks() {
    logger.info("Scraping bank list from ASBA page...")

    try {
      // First, navigate to ASBA page if not already there
      const currentUrl = this.page.url()
      if (!currentUrl.includes("/asba")) {
        logger.info("Navigating to ASBA page...")
        await this.navigateToASBA()
      }

      // Wait for page to load
      await delay(2000)

      // Try to get banks from any Select2 dropdown on the page
      const banks = await this.page.evaluate(() => {
        // Look for all hidden selects (Select2 stores options here)
        const hiddenSelects = document.querySelectorAll("select.select2-hidden-accessible, select")

        for (const select of hiddenSelects) {
          const options = Array.from(select.options)
            .filter((opt) => opt.value && opt.value !== "" && opt.textContent.trim())
            .map((opt) => ({
              value: opt.value,
              text: opt.textContent.trim(),
            }))

          // Return the first select that has bank-like options
          if (
            options.length > 0 &&
            options.some(
              (o) =>
                o.text.toLowerCase().includes("bank") ||
                o.text.toLowerCase().includes("ltd") ||
                o.text.toLowerCase().includes("limited"),
            )
          ) {
            return options
          }
        }

        return []
      })

      if (banks.length === 0) {
        logger.warn("No banks found in hidden selects, trying dropdown method...")
        return await this.scrapeFromOpenDropdown()
      }

      logger.info(`Scraped ${banks.length} banks from ASBA page`)
      return banks
    } catch (error) {
      logger.error(`Failed to scrape bank list: ${error.message}`)
      // Return empty array instead of throwing - allow automation to continue
      return []
    }
  }

  async navigateToASBA() {
    try {
      // Try clicking the ASBA link in sidebar
      const asbaLink = await this.page.$(SELECTORS.NAV.ASBA_LINK)
      if (asbaLink) {
        await asbaLink.click()
        await delay(2000)
        logger.info("Navigated to ASBA via sidebar link")
        return
      }

      // Fallback: direct navigation
      await this.page.goto(URLS.ASBA, {
        waitUntil: "networkidle2",
        timeout: TIMEOUTS.LONG,
      })
      await delay(2000)
      logger.info("Navigated to ASBA via URL")
    } catch (error) {
      logger.error(`Failed to navigate to ASBA: ${error.message}`)
      throw error
    }
  }

  /**
   * Alternative method: Open the dropdown and scrape visible options
   */
  async scrapeFromOpenDropdown() {
    try {
      // Find a Select2 container on the page
      const containers = await this.page.$$(SELECTORS.SELECT2.CONTAINER)

      if (containers.length === 0) {
        logger.warn("No Select2 containers found on page")
        return []
      }

      // Click first container to open dropdown
      await containers[0].click()
      await delay(1000)

      // Wait for dropdown options
      try {
        await this.page.waitForSelector(SELECTORS.SELECT2.OPTION, {
          timeout: TIMEOUTS.SHORT,
        })
      } catch {
        logger.warn("No dropdown options appeared")
        await this.page.keyboard.press("Escape")
        return []
      }

      // Scrape visible options
      const banks = await this.page.evaluate(() => {
        const options = document.querySelectorAll(".select2-results__option")
        return Array.from(options)
          .filter((opt) => opt.textContent.trim())
          .map((option, index) => ({
            value: option.getAttribute("data-select2-id") || String(index),
            text: option.textContent.trim(),
          }))
      })

      // Close dropdown by pressing Escape
      await this.page.keyboard.press("Escape")
      await delay(500)

      logger.info(`Scraped ${banks.length} options from dropdown`)
      return banks
    } catch (error) {
      logger.warn(`Dropdown scrape failed: ${error.message}`)
      return []
    }
  }

  validateBankExists(bankName, bankList) {
    if (bankList.length === 0) {
      logger.warn("Bank list is empty, skipping validation")
      return true
    }

    const normalized = bankName.toLowerCase().trim()
    const match = bankList.find(
      (bank) => bank.text.toLowerCase().trim() === normalized || bank.text.toLowerCase().includes(normalized),
    )

    if (!match) {
      logger.warn(`Bank "${bankName}" not found in available options`)
      logger.info(
        "Available banks:",
        bankList.slice(0, 10).map((b) => b.text),
      )
      return false
    }

    logger.info(`Bank validated: ${match.text}`)
    return true
  }

  normalizeBankName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/limited/gi, "ltd")
      .replace(/private/gi, "pvt")
  }
}
