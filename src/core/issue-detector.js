/**
 * Issue Detection & Matching
 *
 * VALIDATED against actual MeroShare ASBA page HTML
 * - Company list uses div.company-list structure
 * - Apply button is button.btn-issue with <i>Apply</i>
 */

import { logger } from "../utils/logger.js"
import { SELECTORS, TIMEOUTS } from "../config/constants.js"

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class IssueDetector {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async findTargetIssue() {
    logger.info(`Searching for issue: ${this.config.targetIssueName}`)

    try {
      // Wait for company list to load
      await this.page.waitForSelector(SELECTORS.ASBA.COMPANY_LIST, {
        timeout: TIMEOUTS.LONG,
      })

      await delay(2000) // Allow Angular to render

      // Scrape all available issues from company list
      const issues = await this.scrapeIssues()
      logger.info(`Found ${issues.length} available issues`)

      if (issues.length === 0) {
        logger.warn("No issues found on the page")
        await this.debugPageStructure()
        return null
      }

      // Log available issues
      issues.forEach((issue, idx) => {
        logger.debug(`Issue ${idx + 1}: ${issue.name} (${issue.type}) - ${issue.canApply ? "APPLY" : "CLOSED"}`)
      })

      // Match target issue
      const targetIssue = this.matchIssue(issues, this.config.targetIssueName)

      if (targetIssue) {
        logger.info(`Target issue matched: ${targetIssue.name}`)
        logger.info(`Type: ${targetIssue.type} | Group: ${targetIssue.group}`)
        logger.info(`Can Apply: ${targetIssue.canApply ? "YES" : "NO"}`)

        if (!targetIssue.canApply) {
          logger.warn("Issue found but application is not available (button disabled or missing)")
        }
      } else {
        logger.warn(`Issue "${this.config.targetIssueName}" not found`)
        logger.info("Available issues for application:")
        issues.filter((i) => i.canApply).forEach((i) => logger.info(`  - ${i.name}`))
      }

      return targetIssue
    } catch (error) {
      logger.error(`Issue detection failed: ${error.message}`)
      await this.debugPageStructure()
      throw new Error(`Issue detection failed: ${error.message}`)
    }
  }

  async scrapeIssues() {
    return await this.page.evaluate(() => {
      const companyLists = document.querySelectorAll(".company-list")
      const issues = []

      companyLists.forEach((list, index) => {
        try {
          // Get company name - from span with tooltip="Company Name"
          const nameEl =
            list.querySelector('.company-name span[tooltip="Company Name"]') ||
            list.querySelector(".company-name span:first-child")
          const name = nameEl?.textContent?.trim() || ""

          // Get share type (IPO/FPO)
          const typeEl = list.querySelector(".share-of-type")
          const type = typeEl?.textContent?.trim() || ""

          // Get share group
          const groupEl = list.querySelector(".isin")
          const group = groupEl?.textContent?.trim() || ""

          // Get sub group (scrip code)
          const subGroupEl = list.querySelector('span[tooltip="Sub Group"]')
          const subGroup = subGroupEl?.textContent?.trim() || ""

          // Check for Apply button - button.btn-issue
          const applyButton = list.querySelector("button.btn-issue")
          const canApply = applyButton !== null && !applyButton.disabled

          // Only add if we have a valid name
          if (name) {
            issues.push({
              index,
              name,
              type,
              group,
              subGroup,
              canApply,
              element: null, // Cannot serialize DOM elements
            })
          }
        } catch (e) {
          console.error("Error parsing company list item:", e)
        }
      })

      return issues
    })
  }

  matchIssue(issues, targetName) {
    const normalized = targetName.toLowerCase().trim()

    // Strategy 1: Exact match (case insensitive)
    let match = issues.find((issue) => issue.name.toLowerCase().trim() === normalized && issue.canApply)

    // Strategy 2: Partial name match
    if (!match) {
      match = issues.find((issue) => issue.name.toLowerCase().includes(normalized) && issue.canApply)
    }

    // Strategy 3: Target contains issue name
    if (!match) {
      match = issues.find((issue) => normalized.includes(issue.name.toLowerCase().trim()) && issue.canApply)
    }

    // Strategy 4: Word-based match (any significant word matches)
    if (!match) {
      const targetWords = normalized.split(/\s+/).filter((w) => w.length > 2)
      match = issues.find((issue) => {
        const issueWords = issue.name.toLowerCase().split(/\s+/)
        return targetWords.some((tw) => issueWords.some((iw) => iw.includes(tw))) && issue.canApply
      })
    }

    // Return even if not applicable (for better error reporting)
    if (!match) {
      match = issues.find(
        (issue) => issue.name.toLowerCase().includes(normalized) || normalized.includes(issue.name.toLowerCase()),
      )
    }

    return match
  }

  async debugPageStructure() {
    try {
      const structure = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          hasCompanyList: document.querySelectorAll(".company-list").length,
          hasApplyButtons: document.querySelectorAll("button.btn-issue").length,
          pageTitle: document.querySelector(".section-title span")?.textContent || "",
          tabs: Array.from(document.querySelectorAll(".nav-link")).map((t) => t.textContent.trim()),
        }
      })

      logger.debug("Page structure:", JSON.stringify(structure, null, 2))
    } catch (e) {
      logger.warn(`Could not debug page structure: ${e.message}`)
    }
  }

  async clickApplyButton(issue) {
    logger.info(`Clicking Apply button for: ${issue.name}`)

    try {
      // Click the apply button within the matching company list
      const clicked = await this.page.evaluate((issueIndex) => {
        const companyLists = document.querySelectorAll(".company-list")
        if (companyLists[issueIndex]) {
          const button = companyLists[issueIndex].querySelector("button.btn-issue")
          if (button && !button.disabled) {
            button.click()
            return true
          }
        }
        return false
      }, issue.index)

      if (!clicked) {
        throw new Error("Failed to click Apply button")
      }

      await delay(2000)
      logger.info("Apply button clicked, waiting for form to load...")
    } catch (error) {
      throw new Error(`Failed to click apply button: ${error.message}`)
    }
  }
}
