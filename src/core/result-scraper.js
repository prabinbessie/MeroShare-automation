/**
 * Application Results Scraper
 * 
 * Scrapes application reports and tracks allotment status into a JSON file.
 */

import { logger } from "../utils/logger.js"
import { URLS, SELECTORS, TIMEOUTS } from "../config/constants.js"
import { delay } from "../utils/helpers.js"
import { ErrorClassifier } from "../errors/error-classifier.js"
import fs from "fs"
import path from "path"

export class ResultScraper {
  constructor(page, account) {
    this.page = page
    this.account = account
    this.resultsFilePath = path.resolve(process.cwd(), "logs", "application-results.json")
  }

  /**
   * Navigate to Application Report page
   */
  async navigateToReports() {
    try {
      logger.info("Navigating to ASBA page...")
      await this.page.goto(URLS.ASBA, {
        waitUntil: "networkidle2",
        timeout: TIMEOUTS.EXTRA_LONG,
      })

      await this.page.waitForSelector("app-asba, .company-list", {
        timeout: TIMEOUTS.LONG,
      })

      await delay(2000)
      logger.info("ASBA page loaded")

      logger.info("Switching to Application Report tab...")
      
      const tabClicked = await this.page.evaluate(() => {
        const navLinks = document.querySelectorAll(".nav-link, a")
        for (const link of navLinks) {
          const text = link.textContent.trim()
          if (text.includes("Application Report") && !text.includes("Old")) {
            link.click()
            return true
          }
        }
        return false
      })

      if (!tabClicked) {
        throw new Error("Could not find Application Report tab")
      }

      await delay(3000)
      await this.page.waitForSelector(".company-list", { timeout: TIMEOUTS.LONG })
      await delay(2000)
      logger.info("Application Report tab loaded")
      
    } catch (error) {
      throw ErrorClassifier.create(
        "NAVIGATION_ERROR",
        `Failed to navigate to reports: ${error.message}`
      )
    }
  }

  /**
   * Get current company count on page
   */
  async getCompanyCount() {
    return await this.page.evaluate(() => {
      return document.querySelectorAll(".company-list").length
    })
  }

  /**
   * Get company info at specific index
   */
  async getCompanyAtIndex(index) {
    return await this.page.evaluate((idx) => {
      const lists = document.querySelectorAll(".company-list")
      if (!lists[idx]) return null
      
      const list = lists[idx]
      const nameEl = list.querySelector('.company-name span[tooltip="Company Name"]')
      const typeEl = list.querySelector(".share-of-type")
      const groupEl = list.querySelector(".isin")
      
      return {
        name: nameEl?.textContent?.trim() || "Unknown",
        type: typeEl?.textContent?.trim() || "",
        group: groupEl?.textContent?.trim() || "",
      }
    }, index)
  }

  /**
   * Click report button at specific index
   */
  async clickReportButtonAtIndex(index) {
    return await this.page.evaluate((idx) => {
      const lists = document.querySelectorAll(".company-list")
      if (!lists[idx]) return false
      
      const button = lists[idx].querySelector("button.btn-issue")
      if (button) {
        button.click()
        return true
      }
      return false
    }, index)
  }

  /**
   * back button to return to list so we can scrape more
   */
  async clickBackButton() {
    try {
      await this.page.waitForSelector(".casba-bck-btn, button.casba-bck-btn", { timeout: 5000 })
      
      const clicked = await this.page.evaluate(() => {
        const backBtn = document.querySelector(".casba-bck-btn") || 
                       document.querySelector("button.casba-bck-btn") ||
                       document.querySelector(".back-button-block button")
        if (backBtn) {
          backBtn.click()
          return true
        }
        return false
      })
      
      if (clicked) {
        await delay(2000)
        await this.page.waitForSelector(".company-list", { timeout: TIMEOUTS.MEDIUM })
        await delay(1000)
        return true
      }
      return false
    } catch (error) {
      logger.warn(`Back button click failed: ${error.message}`)
      return false
    }
  }

  /**
   * Get all company names from the page
   */
  async getAllCompanyNames() {
    return await this.page.evaluate(() => {
      const lists = document.querySelectorAll(".company-list")
      const companies = []
      
      lists.forEach((list, index) => {
        const nameEl = list.querySelector('.company-name span[tooltip="Company Name"]')
        const name = nameEl?.textContent?.trim() || ""
        if (name) companies.push({ index, name })
      })
      
      return companies
    })
  }

  /**
   * Find which companies need to be scraped (new or pending status check)
   */
  findCompaniesToScrape(pageCompanies, existingResults) {
    const existingMap = new Map(existingResults.map(r => [r.companyName, r]))
    const toScrape = []
    const cached = []

    for (const company of pageCompanies) {
      const existing = existingMap.get(company.name)
      
      if (!existing) {
        //if mo exting result, need to scrape
        toScrape.push(company)
      } else if (!existing.isAlloted && existing.status !== "Not Alloted") {
        // Pending sts
        toScrape.push(company)
      } else {
        cached.push(existing)
      }
    }

    return { toScrape, cached }
  }

  /**
   * Scrape application results 
   */
  async scrapeAllResults() {
    const results = []

    try {
      await this.page.waitForSelector(".company-list", { timeout: TIMEOUTS.MEDIUM })
      await delay(2000)

      // getall company names from page list 
      const pageCompanies = await this.getAllCompanyNames()

      if (pageCompanies.length === 0) {
        logger.info("No applications found in reports")
        return results
      }

      //what item needs scraping
      const previousData = this.loadPreviousResults()
      const existingResults = previousData[this.account.username]?.applications || []
      const { toScrape, cached } = this.findCompaniesToScrape(pageCompanies, existingResults)

      logger.info(`Found ${pageCompanies.length} application(s) on page`)
      logger.info(`  → Cached: ${cached.length} (already have final status)`)
      logger.info(`  → To scrape: ${toScrape.length} (new or pending)`)
      results.push(...cached)
      if (toScrape.length === 0) {
        logger.info("All applications already have final status - no scraping needed!")
        return results
      }

      for (let i = 0; i < toScrape.length; i++) {
        const company = toScrape[i]
        
        try {
          logger.info(`[${i + 1}/${toScrape.length}] Scraping: ${company.name}`)
          const clicked = await this.clickReportButtonAtIndex(company.index)
          
          if (!clicked) {
            logger.warn(`Could not click report button for ${company.name}`)
            continue
          }

          await delay(2000)
          const detailLoaded = await Promise.race([
            this.page.waitForSelector("app-application-report", { timeout: TIMEOUTS.MEDIUM }).then(() => true),
            this.page.waitForSelector(".section-block .form-group", { timeout: TIMEOUTS.MEDIUM }).then(() => true),
          ]).catch(() => false)

          if (!detailLoaded) {
            logger.warn(`Detail page did not load for ${company.name}`)
            await this.clickBackButton()
            continue
          }

          await delay(1500)

          const fullCompanyInfo = await this.getCompanyAtIndex(company.index).catch(() => ({ name: company.name, type: "", group: "" }))
          const details = await this.extractApplicationDetails(fullCompanyInfo || { name: company.name, type: "", group: "" })

          if (details) {
            results.push({
              ...details,
              scrapedAt: new Date().toISOString(),
            })
            logger.info(`✓ ${company.name} - ${details.status}`)
          }          const backSuccess = await this.clickBackButton()
          if (!backSuccess) {
            logger.warn("Failed to go back, re-navigating...")
            await this.navigateToReports()
          }

          await delay(1000)

        } catch (error) {
          logger.warn(`Failed to scrape ${company.name}: ${error.message}`)
          const backSuccess = await this.clickBackButton()
          if (!backSuccess) await this.navigateToReports()
          await delay(500)
        }
      }
    } catch (error) {
      throw ErrorClassifier.create(
        "FORM_ERROR",
        `Failed to scrape results: ${error.message}`
      )
    }

    return results
  }

  /**
   * Extract application details from detail page
   */
  async extractApplicationDetails(companyInfo) {
    try {
      const details = await this.page.evaluate((info) => {
        const getLabelValue = (labelText) => {
          const rows = document.querySelectorAll(".section-block--borderless .col-md-12 .row")
          for (const row of rows) {
            const label = row.querySelector(".col-md-3 label")
            const value = row.querySelector(".col-md-7 .input-group label")
            if (label && label.textContent.trim().includes(labelText) && value) {
              return value.textContent.trim()
            }
          }
                    const formGroups = document.querySelectorAll(".section-block .col-md-4 .form-group")
          for (const group of formGroups) {
            const label = group.querySelector("label")
            const valueSpan = group.querySelector(".form-value span")
            if (label && label.textContent.trim().includes(labelText) && valueSpan) {
              return valueSpan.textContent.trim()
            }
          }
          
          return ""
        }

        const status = getLabelValue("Status")
        const isAlloted = /allot(ed)?/i.test(status)

        return {
          companyName: info.name,
          type: info.type,
          group: info.group,
          status,
          isAlloted,
          appliedQty: parseInt(getLabelValue("Applied Quantity")) || 0,
          allotedQty: isAlloted ? (parseInt(getLabelValue("Alloted Quantity")) || 0) : 0,
          pricePerShare: parseFloat(getLabelValue("Price per Share")) || 0,
          amount: parseFloat(getLabelValue("Amount").replace(/,/g, '')) || 0,
          submittedDate: getLabelValue("Application submitted date"),
          issueOpenDate: getLabelValue("Issue Open Date"),
          issueCloseDate: getLabelValue("Issue Close Date"),
          bank: getLabelValue("Bank"),
          branch: getLabelValue("Branch"),
          accountNumber: getLabelValue("Account Number"),
          minQty: parseInt(getLabelValue("Minimum Quantity")) || 0,
          maxQty: parseInt(getLabelValue("Maximum Quantity")) || 0,
          remarks: getLabelValue("Remarks"),
        }
      }, companyInfo)

      return details
    } catch (error) {
      logger.warn(`Failed to extract details: ${error.message}`)
      return null
    }
  }

  /**
   * Load previous results from file
   */
  loadPreviousResults() {
    try {
      if (fs.existsSync(this.resultsFilePath)) {
        const data = fs.readFileSync(this.resultsFilePath, "utf8")
        return JSON.parse(data)
      }
    } catch (error) {
      logger.warn(`Failed to load previous results: ${error.message}`)
    }
    return {}
  }

  /**
   * merge new results with existing
   */
  saveResults(accountUsername, newResults) {
    try {
      const allResults = this.loadPreviousResults()
      const previousApps = allResults[accountUsername]?.applications || []
      
      const existingMap = new Map(previousApps.map(app => [app.companyName, app]))
      
      for (const newApp of newResults) {
        existingMap.set(newApp.companyName, newApp)
      }
      
      const mergedApps = Array.from(existingMap.values())
        .sort((a, b) => a.companyName.localeCompare(b.companyName))

      allResults[accountUsername] = {
        lastUpdated: new Date().toISOString(),
        applications: mergedApps,
      }

      fs.writeFileSync(this.resultsFilePath, JSON.stringify(allResults, null, 2))
      logger.info(`Results saved: ${mergedApps.length} total applications tracked`)
    } catch (error) {
      logger.error(`Failed to save results: ${error.message}`)
    }
  }

  /**
   * Compare with previous results and detect changes
   */
  compareResults(accountUsername, newResults) {
    const previousData = this.loadPreviousResults()
    const previousApps = previousData[accountUsername]?.applications || []
    const previousMap = new Map(previousApps.map(r => [r.companyName, r]))

    const changes = {
      newAllotments: [],
      updatedAllotments: [],
      newApplications: [],
    }

    for (const newResult of newResults) {
      const previous = previousMap.get(newResult.companyName)

      if (!previous) {
        changes.newApplications.push(newResult)
        if (newResult.isAlloted) {
          changes.newAllotments.push(newResult)
        }
      } else if (newResult.isAlloted && !previous.isAlloted) {
        changes.newAllotments.push(newResult)
      } else if (newResult.isAlloted && previous.isAlloted && newResult.allotedQty !== previous.allotedQty) {
        changes.updatedAllotments.push({ ...newResult, previousQty: previous.allotedQty })
      }
    }

    return changes
  }

  /**
   * Log results summary
   */
  logSummary(results, changes = null) {
    const alloted = results.filter(r => r.isAlloted)
    const notAlloted = results.filter(r => !r.isAlloted)

    logger.info("================================================================")
    logger.info("  APPLICATION RESULTS SUMMARY")
    logger.info("================================================================")
    logger.info(`  Total: ${results.length} | Alloted: ${alloted.length} | Pending: ${notAlloted.length}`)
    logger.info(`  Total Alloted Shares: ${alloted.reduce((sum, r) => sum + r.allotedQty, 0)}`)
    logger.info("----------------------------------------------------------------")

    results.forEach(r => {
      const icon = r.isAlloted ? "✓" : "○"
      const status = r.isAlloted ? `Alloted: ${r.allotedQty}` : r.status
      logger.info(`  ${icon} ${r.companyName} - ${status}`)
    })

    logger.info("================================================================")

    if (changes?.newAllotments.length > 0) {
      logger.info("")
      logger.info("🎉 NEW ALLOTMENTS!")
      changes.newAllotments.forEach(r => logger.info(`  ✓ ${r.companyName}: ${r.allotedQty} shares`))
    }

    if (changes?.updatedAllotments.length > 0) {
      logger.info("")
      logger.info("UPDATED ALLOTMENTS:")
      changes.updatedAllotments.forEach(r => logger.info(`  ↑ ${r.companyName}: ${r.previousQty} → ${r.allotedQty}`))
    }

    if (changes?.newApplications.length > 0) {
      logger.info("")
      logger.info("📝 NEW APPLICATIONS:")
      changes.newApplications.forEach(r => logger.info(`  + ${r.companyName}`))
    }
  }

  /**
   * execution
   */
  async execute() {
    try {
      await this.navigateToReports()
      const results = await this.scrapeAllResults()
      const changes = this.compareResults(this.account.username, results)
      
      this.logSummary(results, changes)
      this.saveResults(this.account.username, results)

      return {
        success: true,
        results,
        changes,
        summary: {
          total: results.length,
          alloted: results.filter(r => r.isAlloted).length,
          totalShares: results.filter(r => r.isAlloted).reduce((sum, r) => sum + r.allotedQty, 0),
        },
      }
    } catch (error) {
      logger.error(`Result scraping failed: ${error.message}`)
      return { success: false, error: error.message, results: [] }
    }
  }
}