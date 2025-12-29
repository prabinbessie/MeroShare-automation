/**
 * Authentication Handler
 *
 * Manages login flow 
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
      // await this.detectSecurityChallenges()

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

      await clearAndType(this.page, passwordInput, this.config.password)
      const enteredLength = await this.page.evaluate((el) => el.value.length, passwordInput)
      if (enteredLength !== this.config.password.length) {
        logger.warn(`Password length mismatch - expected ${this.config.password.length}, got ${enteredLength}`)
        //retry with delay
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
      await submitButton.click() 
      logger.debug("Clicked submit button")
      await delay(2000)
    } catch (error) {
      throw new Error(`Form submission failed: ${error.message}`)
    }
  }
//as we dont have security challenges now for future
  // async detectSecurityChallenges() {
  // //   //for CAPTCHA
  // //   const captcha = await this.page.$('img[src*="captcha"], .captcha')
  // //   if (captcha) {
  // //     throw ErrorClassifier.create("SECURITY_INTERRUPTION", "CAPTCHA detected. Manual intervention required.")
  // //   }

  //   // const otp = await this.page.$('input[placeholder*="OTP"], input[name*="otp"]')
  //   // if (otp) {
  //   //   throw ErrorClassifier.create("SECURITY_INTERRUPTION", "OTP challenge detected. Manual intervention required.")
  //   // }

  //   logger.debug("No security challenges detected")
  // }

  async verifyLoginSuccess() {
    try {
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
        const currentUrl = this.page.url()
        if (currentUrl.includes("/login")) {
          const errorElement = await this.page.$(SELECTORS.LOGIN.ERROR_MESSAGE)
          if (errorElement) {
            const errorText = await errorElement.evaluate((el) => el.textContent)
            throw new Error(`Login rejected: ${errorText.trim()}`)
          }
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