/**
 * Authentication Handler
 *
 * Manages login flow with Select2 dropdown handling
 * Based on actual MeroShare HTML structure
 */

import { logger } from "../utils/logger.js"
import { URLS, SELECTORS, TIMEOUTS } from "../config/constants.js"
import { ErrorClassifier } from "../errors/error-classifier.js"
import { delay, typeText, clearAndType } from "../utils/helpers.js"

export class LoginHandler {
  constructor(page, config) {
    this.page = page
    this.config = config
  }

  async navigate() {
    logger.info(`Navigating to login page: ${URLS.LOGIN}`)
    await this.page.goto(URLS.LOGIN, {
      waitUntil: "networkidle2",
      timeout: this.config.navigationTimeout,
    })
    await delay(2000, 3000)
    logger.info("Login page loaded")
  }

  async login() {
    try {
      // Check for security challenges first
      await this.detectSecurityChallenges()

      // Wait for login form to be ready
      await this.page.waitForSelector(SELECTORS.LOGIN.LOGIN_FORM, {
        timeout: TIMEOUTS.MEDIUM,
      })
      logger.info("Login form detected")

      // Step 1: Select DP using Select2 dropdown
      logger.info("Selecting Depository Participant...")
      await this.selectDPWithSelect2()
      await delay(this.config.actionDelayMin, this.config.actionDelayMax)

      // Step 2: Enter username
      logger.info("Entering username...")
      await this.fillUsername()
      await delay(this.config.actionDelayMin, this.config.actionDelayMax)

      // Step 3: Enter password
      logger.info("Entering password...")
      await this.fillPassword()
      await delay(this.config.actionDelayMin, this.config.actionDelayMax)

      // Step 4: Submit form
      logger.info("Submitting login form...")
      await this.submitForm()

      // Step 5: Verify login success
      await this.verifyLoginSuccess()

      logger.info("Login completed successfully")
    } catch (error) {
      // Take screenshot on error
      await this.captureErrorScreenshot("login-error")
      throw ErrorClassifier.create("AUTH_ERROR", `Login failed: ${error.message}`)
    }
  }

  /**
   * Handle Select2 dropdown for DP selection
   * MeroShare uses Select2 library which requires special handling
   */
  async selectDPWithSelect2() {
    try {
      // Wait for Select2 container to be present
      await this.page.waitForSelector(SELECTORS.LOGIN.DP_CONTAINER, {
        timeout: TIMEOUTS.MEDIUM,
      })

      // Click on the Select2 container to open dropdown
      const select2Container = await this.page.$(SELECTORS.LOGIN.DP_CONTAINER)
      if (!select2Container) {
        throw new Error("Select2 container not found for DP dropdown")
      }

      await select2Container.click()
      logger.debug("Clicked Select2 container to open dropdown")

      // Wait for dropdown to open (search field appears)
      await this.page.waitForSelector(SELECTORS.SELECT2.SEARCH_FIELD, {
        timeout: TIMEOUTS.SHORT,
      })
      await delay(500)

      const searchInput = await this.page.$(SELECTORS.SELECT2.SEARCH_FIELD)
      if (!searchInput) {
        throw new Error("Select2 search field not found")
      }

      // Focus and type using robust method
      await searchInput.focus()
      await delay(100)

      // Type character by character with proper delays
      await typeText(this.page, this.config.dpName, 80)
      logger.debug(`Typed DP name: ${this.config.dpName}`)

      // Wait for options to filter
      await delay(1500)

      // Wait for options to appear
      await this.page.waitForSelector(SELECTORS.SELECT2.OPTION, {
        timeout: TIMEOUTS.SHORT,
      })

      // Find and click the matching option
      const optionClicked = await this.page.evaluate((dpName) => {
        const options = document.querySelectorAll(".select2-results__option")
        for (const option of options) {
          const text = option.textContent.toLowerCase()
          if (text.includes(dpName.toLowerCase())) {
            option.click()
            return true
          }
        }
        // If no exact match, click the first/highlighted option
        const highlighted = document.querySelector(".select2-results__option--highlighted")
        if (highlighted) {
          highlighted.click()
          return true
        }
        if (options.length > 0) {
          options[0].click()
          return true
        }
        return false
      }, this.config.dpName)

      if (!optionClicked) {
        // Fallback: press Enter to select highlighted option
        await this.page.keyboard.press("Enter")
      }

      await delay(500)
      logger.info(`DP selected: ${this.config.dpName}`)
    } catch (error) {
      logger.error(`Failed to select DP: ${error.message}`)
      throw new Error(`DP selection failed: ${error.message}`)
    }
  }

  async fillUsername() {
    try {
      await this.page.waitForSelector(SELECTORS.LOGIN.USERNAME_INPUT, {
        timeout: TIMEOUTS.SHORT,
      })

      const usernameInput = await this.page.$(SELECTORS.LOGIN.USERNAME_INPUT)
      if (!usernameInput) {
        throw new Error("Username input not found")
      }

      // Clear and type with robust method
      await clearAndType(this.page, usernameInput, this.config.username)

      // Verify the value was entered correctly
      const enteredValue = await this.page.evaluate((el) => el.value, usernameInput)
      if (enteredValue !== this.config.username) {
        logger.warn(`Username mismatch - expected ${this.config.username.length} chars, got ${enteredValue.length}`)
        // Retry with slower typing
        await clearAndType(this.page, usernameInput, this.config.username, 150)
      }

      logger.debug("Username entered successfully")
    } catch (error) {
      throw new Error(`Failed to fill username: ${error.message}`)
    }
  }

  async fillPassword() {
    try {
      await this.page.waitForSelector(SELECTORS.LOGIN.PASSWORD_INPUT, {
        timeout: TIMEOUTS.SHORT,
      })

      const passwordInput = await this.page.$(SELECTORS.LOGIN.PASSWORD_INPUT)
      if (!passwordInput) {
        throw new Error("Password input not found")
      }

      // Clear and type with robust method
      await clearAndType(this.page, passwordInput, this.config.password)

      // Verify length (can't check actual value for password)
      const enteredLength = await this.page.evaluate((el) => el.value.length, passwordInput)
      if (enteredLength !== this.config.password.length) {
        logger.warn(`Password length mismatch - expected ${this.config.password.length}, got ${enteredLength}`)
        // Retry with slower typing
        await clearAndType(this.page, passwordInput, this.config.password, 150)
      }

      logger.debug("Password entered successfully")
    } catch (error) {
      throw new Error(`Failed to fill password: ${error.message}`)
    }
  }

  async submitForm() {
    try {
      const submitButton = await this.page.$(SELECTORS.LOGIN.SUBMIT_BUTTON)
      if (!submitButton) {
        throw new Error("Submit button not found")
      }

      // MeroShare is an Angular SPA - it doesn't do full page navigation
      // Instead we wait for dashboard elements to appear
      await submitButton.click()
      logger.debug("Clicked submit button")

      // Wait for either dashboard to load or error to appear
      await delay(2000)
    } catch (error) {
      throw new Error(`Form submission failed: ${error.message}`)
    }
  }

  async detectSecurityChallenges() {
    // Check for CAPTCHA
    const captcha = await this.page.$('img[src*="captcha"], .captcha')
    if (captcha) {
      throw ErrorClassifier.create("SECURITY_INTERRUPTION", "CAPTCHA detected. Manual intervention required.")
    }

    // Check for OTP input
    const otp = await this.page.$('input[placeholder*="OTP"], input[name*="otp"]')
    if (otp) {
      throw ErrorClassifier.create("SECURITY_INTERRUPTION", "OTP challenge detected. Manual intervention required.")
    }

    logger.debug("No security challenges detected")
  }

  async verifyLoginSuccess() {
    try {
      // Wait for any dashboard indicator to appear
      // Using multiple possible selectors from actual MeroShare HTML
      const dashboardSelectors = [
        "app-dashboard",
        ".sidebar-nav",
        ".app-body .sidebar",
        'a[href="#/asba"]',
        ".user-profile-name",
      ]

      let dashboardFound = false
      for (const selector of dashboardSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: TIMEOUTS.MEDIUM })
          logger.debug(`Dashboard indicator found: ${selector}`)
          dashboardFound = true
          break
        } catch {
          continue
        }
      }

      if (!dashboardFound) {
        // Check if still on login page with error
        const currentUrl = this.page.url()
        if (currentUrl.includes("/login")) {
          const errorElement = await this.page.$(SELECTORS.LOGIN.ERROR_MESSAGE)
          if (errorElement) {
            const errorText = await errorElement.evaluate((el) => el.textContent)
            throw new Error(`Login rejected: ${errorText.trim()}`)
          }

          // Check for toast error
          const toastError = await this.page.$(".toast-error, .toast-message")
          if (toastError) {
            const errorText = await toastError.evaluate((el) => el.textContent)
            throw new Error(`Login failed: ${errorText.trim()}`)
          }

          throw new Error("Login failed - still on login page")
        }
      }

      logger.info("Login verified - Dashboard loaded")
    } catch (error) {
      throw error
    }
  }

  async captureErrorScreenshot(prefix) {
    try {
      const timestamp = Date.now()
      const screenshotPath = `screenshots/${prefix}-${timestamp}.png`
      await this.page.screenshot({ path: screenshotPath, fullPage: true })
      logger.info(`Error screenshot saved: ${screenshotPath}`)
    } catch (e) {
      logger.warn(`Failed to capture screenshot: ${e.message}`)
    }
  }
}
/**
 * Authentication Handler - PRODUCTION READY
 *
 * Handles MeroShare login with Select2 dropdown and proper
 * field typing to avoid character truncation issues.
 */

// import { logger } from "../utils/logger.js"
// import { URLS, SELECTORS, TIMEOUTS } from "../config/constants.js"
// import { ErrorClassifier } from "../errors/error-classifier.js"

// function delay(min, max = min) {
//   const ms = max > min ? Math.floor(Math.random() * (max - min + 1)) + min : min
//   return new Promise((resolve) => setTimeout(resolve, ms))
// }

// export class LoginHandler {
//   constructor(page, config) {
//     this.page = page
//     this.config = config
//   }

//   async navigate() {
//     logger.info(`Navigating to: ${URLS.LOGIN}`)
//     await this.page.goto(URLS.LOGIN, {
//       waitUntil: "networkidle2",
//       timeout: 60000,
//     })
//     await delay(2000, 3000)
//     logger.info("Login page loaded")
//   }

//   async login() {
//     try {
//       await this.detectSecurityChallenges()
//       await delay(1000)

//       // Step 1: Select DP
//       logger.info("Selecting Depository Participant...")
//       await this.selectDP()
//       await delay(500, 1000)

//       // Step 2: Enter username using direct value setting
//       logger.info("Entering username...")
//       await this.fillField(SELECTORS.LOGIN.USERNAME_INPUT, this.config.username)
//       await delay(300, 500)

//       // Step 3: Enter password using direct value setting
//       logger.info("Entering password...")
//       await this.fillField(SELECTORS.LOGIN.PASSWORD_INPUT, this.config.password)
//       await delay(300, 500)

//       // Step 4: Submit
//       logger.info("Submitting login...")
//       await this.submitForm()

//       // Step 5: Verify
//       await this.verifyLoginSuccess()

//       logger.info("Login successful")
//     } catch (error) {
//       await this.captureScreenshot("login-error")
//       throw ErrorClassifier.create("AUTH_ERROR", `Login failed: ${error.message}`)
//     }
//   }

//   async selectDP() {
//     try {
//       // Wait for Select2 to be ready
//       await this.page.waitForSelector(SELECTORS.SELECT2.CONTAINER, { timeout: TIMEOUTS.MEDIUM })

//       // Click to open dropdown
//       await this.page.click(SELECTORS.SELECT2.CONTAINER)
//       await delay(500)

//       // Wait for search field
//       await this.page.waitForSelector(SELECTORS.SELECT2.SEARCH_FIELD, {
//         visible: true,
//         timeout: TIMEOUTS.SHORT,
//       })

//       // Type DP name into search
//       const searchField = await this.page.$(SELECTORS.SELECT2.SEARCH_FIELD)
//       await searchField.click()
//       await delay(100)

//       // Type character by character
//       for (const char of this.config.dpName) {
//         await this.page.keyboard.type(char, { delay: 30 })
//       }

//       await delay(1000)

//       // Wait for and click matching option
//       await this.page.waitForSelector(SELECTORS.SELECT2.OPTION, { timeout: TIMEOUTS.SHORT })

//       const selected = await this.page.evaluate((dpName) => {
//         const options = document.querySelectorAll(".select2-results__option")
//         const dpLower = dpName.toLowerCase()

//         for (const opt of options) {
//           const text = opt.textContent.trim().toLowerCase()
//           if (text.includes(dpLower) || dpLower.includes(text.split("(")[0].trim())) {
//             opt.click()
//             return opt.textContent.trim()
//           }
//         }

//         // Click first available
//         const highlighted = document.querySelector(".select2-results__option--highlighted")
//         if (highlighted) {
//           highlighted.click()
//           return highlighted.textContent.trim()
//         }

//         if (options[0]) {
//           options[0].click()
//           return options[0].textContent.trim()
//         }

//         return null
//       }, this.config.dpName)

//       if (!selected) {
//         await this.page.keyboard.press("Enter")
//       }

//       await delay(500)
//       logger.info(`DP selected: ${selected || this.config.dpName}`)
//     } catch (error) {
//       throw new Error(`DP selection failed: ${error.message}`)
//     }
//   }

//   /**
//    * Fill field using direct value setting to avoid character issues
//    * This is more reliable than keyboard typing for form fields
//    */
//   async fillField(selector, value) {
//     try {
//       await this.page.waitForSelector(selector, { visible: true, timeout: TIMEOUTS.SHORT })

//       // Set value directly via JavaScript
//       await this.page.evaluate(
//         (sel, val) => {
//           const input = document.querySelector(sel)
//           if (input) {
//             input.focus()
//             input.value = val
//             // Trigger Angular change detection
//             input.dispatchEvent(new Event("input", { bubbles: true }))
//             input.dispatchEvent(new Event("change", { bubbles: true }))
//             input.dispatchEvent(new Event("blur", { bubbles: true }))
//           }
//         },
//         selector,
//         value,
//       )

//       // Verify value was set
//       const actualValue = await this.page.evaluate((sel) => {
//         const input = document.querySelector(sel)
//         return input ? input.value : ""
//       }, selector)

//       if (actualValue !== value) {
//         // Fallback: clear and type manually
//         logger.debug("Direct set failed, using keyboard input...")
//         await this.page.click(selector, { clickCount: 3 })
//         await this.page.keyboard.press("Backspace")

//         for (const char of value) {
//           await this.page.keyboard.type(char, { delay: 50 })
//         }
//       }

//       logger.debug(`Field filled: ${selector.includes("password") ? "***" : value.substring(0, 3) + "***"}`)
//     } catch (error) {
//       throw new Error(`Failed to fill ${selector}: ${error.message}`)
//     }
//   }

//   async submitForm() {
//     try {
//       const submitBtn = await this.page.$(SELECTORS.LOGIN.SUBMIT_BUTTON)
//       if (!submitBtn) throw new Error("Submit button not found")

//       // Check if enabled
//       const isDisabled = await submitBtn.evaluate((btn) => btn.disabled)
//       if (isDisabled) {
//         logger.warn("Submit button disabled, waiting...")
//         await delay(2000)
//       }

//       // Click and wait for navigation
//       await Promise.race([
//         Promise.all([
//           this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: TIMEOUTS.LONG }).catch(() => {}),
//           submitBtn.click(),
//         ]),
//         delay(TIMEOUTS.LONG),
//       ])

//       await delay(3000)
//     } catch (error) {
//       throw new Error(`Form submission failed: ${error.message}`)
//     }
//   }

//   async detectSecurityChallenges() {
//     const captcha = await this.page.$('img[src*="captcha"], .captcha, .g-recaptcha')
//     if (captcha) {
//       throw ErrorClassifier.create("SECURITY_INTERRUPTION", "CAPTCHA detected - manual intervention required")
//     }

//     const otp = await this.page.$('input[placeholder*="OTP"], input[name*="otp"]')
//     if (otp) {
//       throw ErrorClassifier.create("SECURITY_INTERRUPTION", "OTP required - manual intervention needed")
//     }
//   }

//   async verifyLoginSuccess() {
//     try {
//       await this.page.waitForSelector(SELECTORS.LOGIN.DASHBOARD_INDICATOR, {
//         timeout: TIMEOUTS.LONG,
//       })

//       const currentUrl = this.page.url()
//       if (currentUrl.includes("/login")) {
//         const errorEl = await this.page.$(".toast-error, .alert-danger")
//         if (errorEl) {
//           const errorText = await errorEl.evaluate((el) => el.textContent)
//           throw new Error(`Login rejected: ${errorText.trim()}`)
//         }
//         throw new Error("Still on login page")
//       }

//       logger.info("Dashboard loaded - login verified")
//     } catch (error) {
//       const toast = await this.page.$(".toast-message")
//       if (toast) {
//         const text = await toast.evaluate((el) => el.textContent)
//         if (text.toLowerCase().includes("invalid")) {
//           throw new Error(`Invalid credentials: ${text.trim()}`)
//         }
//       }
//       throw error
//     }
//   }

//   async captureScreenshot(prefix) {
//     try {
//       const path = `screenshots/${prefix}-${Date.now()}.png`
//       await this.page.screenshot({ path, fullPage: true })
//       logger.info(`Screenshot: ${path}`)
//     } catch (e) {
//       logger.warn(`Screenshot failed: ${e.message}`)
//     }
//   }
// }

