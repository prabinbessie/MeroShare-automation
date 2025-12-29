/**
 * Screenshot Capture Utility
 *
 * Captures sanitized screenshots for debugging
 */

import { mkdir } from "fs/promises"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { logger } from "../utils/logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SCREENSHOT_DIR = join(__dirname, "../../screenshots")

export async function captureScreenshot(page, filename) {
  try {
    //directory exists
    await mkdir(SCREENSHOT_DIR, { recursive: true })

    const filepath = join(SCREENSHOT_DIR, `${filename}.png`)

    await page.screenshot({
      path: filepath,
      fullPage: true,
    })

    logger.info(`Screenshot saved: ${filepath}`)
    return filepath
  } catch (error) {
    logger.error("Screenshot capture failed:", error.message)
    throw error
  }
}
