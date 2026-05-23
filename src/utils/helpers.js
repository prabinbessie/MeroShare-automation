/**
 * Utility Helper Functions
 */

export async function delay(minMs, maxMs = null) {
  const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function typeText(page, text, delayMs = 50) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs })
    await delay(delayMs / 2, delayMs)
  }
}

export async function clearAndType(page, element, text, delayMs = 50) {
  await element.click({ clickCount: 3 })
  await delay(50)
  await page.keyboard.press("Backspace")
  await delay(50)

  await page.evaluate((el) => {
    el.value = ""
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, element)
  await element.focus()
  await delay(50)

  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs })
  }
  await page.evaluate((el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }, element)
}
