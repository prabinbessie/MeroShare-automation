/**
 * Utility Helper Functions
 * 
 */

export async function delay(minMs, maxMs = null) {
  const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatDate(date) {
  return new Date(date).toISOString().split("T")[0]
}

export function parseNepalDate(dateStr) {
  return dateStr
}

export async function typeText(page, text, delayMs = 50) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs })
    await delay(delayMs / 2, delayMs)
  }
}

export async function clearAndType(page, element, text, delayMs = 50) {
  // Focus the element
  await element.focus()
  await delay(100)

  // Ctrl+A
  await page.keyboard.down("Control")
  await page.keyboard.press("a")
  await page.keyboard.up("Control")
  await delay(50)

  //ctrl + backspace
  await page.keyboard.press("Backspace")
  await delay(100)

  // select all
  await page.click(selector, { clickCount: 3 })
  await delay(50)
  await page.keyboard.press("Backspace")
  await delay(100)
  await page.evaluate((el) => {
    el.value = ""
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, element)
  await delay(100)

  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs })
  }
  await page.evaluate((el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }, element)

  await delay(100)
}

export async function selectFromSelect2(page, containerSelector, searchText, options = {}) {
  const timeout = options.timeout || 5000
  const typeDelay = options.typeDelay || 80
  await page.click(containerSelector)
  await delay(500)
  await page.waitForSelector("input.select2-search__field", { timeout: timeout })
  await page.click("input.select2-search__field")
  await delay(100)
  await typeText(page, searchText, typeDelay)
  await delay(1000)
  await page.waitForSelector(".select2-results__option", { timeout: timeout })
  const clicked = await page.evaluate(function(search) {
    var options = document.querySelectorAll(".select2-results__option")
    for (var i = 0; i < options.length; i++) {
      if (options[i].textContent.toLowerCase().includes(search.toLowerCase())) {
        options[i].click()
        return true
      }
    }
    if (options.length > 0) {
      options[0].click()
      return true
    }
    return false
  }, searchText)

  if (!clicked) {
    await page.keyboard.press("enter ")
  }

  await delay(500)
}