#!/usr/bin/env node

/**
 * MeroShare IPO Auto-Runner
 * 
 * Fetches open IPOs from the ipo-alert cloud system and automatically
 * triggers the puppeteer automation to fill ASBA forms.
 * 
 * Designed to run on device startup (via launchd on Mac / Task Scheduler on Windows)
 * and only process each IPO once.
 * 
 * Usage:
 *   node src/bridge/auto-runner.js           # Normal mode - check and apply
 *   node src/bridge/auto-runner.js --dry-run # Preview mode - show what would run
 */

import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "../..")
const ENV_FILE = path.join(PROJECT_ROOT, ".env")

dotenv.config({ path: ENV_FILE })

const IPO_FEED_URL =
  process.env.IPO_FEED_URL ||
  "https://raw.githubusercontent.com/prabinbessie/scrappy/dev/data/ipo/ipo_feed.json"
const SYNC_TARGET_ISSUE_TO_ENV = process.env.AUTO_RUNNER_SYNC_TARGET_IN_ENV !== "false"

const STATE_FILE = path.join(PROJECT_ROOT, "bridge-data", "state.json")
const LOG_FILE = path.join(PROJECT_ROOT, "logs", "autorun.log")

// ── Logging ──

function log(msg) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}`
  console.log(line)
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, line + "\n")
  } catch {
    // ignore log write errors
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"))
  } catch {
    return {
      alerts_sent_by_issue: {},
      automation_triggered_by_issue: {},
      updated_at: null,
    }
  }
}

function saveState(state) {
  state.updated_at = new Date().toISOString()
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function formatEnvValue(value, quote = false) {
  const normalized = String(value).replace(/\r?\n/g, " ").trim()
  if (!quote) {
    return normalized
  }
  return `"${normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function upsertEnvValue(key, value, quote = false) {
  const current = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf-8") : ""
  const entry = `${key}=${formatEnvValue(value, quote)}`
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}=.*$`, "m")

  let next
  if (pattern.test(current)) {
    next = current.replace(pattern, entry)
  } else {
    const suffix = current.length > 0 && !current.endsWith("\n") ? "\n" : ""
    next = `${current}${suffix}${entry}\n`
  }

  fs.writeFileSync(ENV_FILE, next)
}

function syncTargetIssueInEnv(issueName) {
  if (!SYNC_TARGET_ISSUE_TO_ENV) {
    return
  }

  if (!fs.existsSync(ENV_FILE)) {
    log(".env sync skipped: file not found")
    return
  }

  try {
    upsertEnvValue("TARGET_ISSUE_NAME", issueName, true)
    upsertEnvValue("RESULTS_MODE", "false")
    log(`Synced TARGET_ISSUE_NAME in .env: ${issueName}`)
  } catch (error) {
    log(`.env sync failed: ${error.message}`)
  }
}

// ── IPO Feed ──

async function fetchOpenIpos() {
  log("Fetching IPO feed from cloud...")
  const res = await fetch(IPO_FEED_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch IPO feed: ${res.status}`)
  }
  const data = await res.json()

  const openIpos = data.open || []
  const upcomingIpos = data.upcoming || []

  log(`Feed: ${openIpos.length} open, ${upcomingIpos.length} upcoming`)
  return { openIpos, upcomingIpos, meta: data.meta }
}

// ── Automation Trigger ──

function runAutomation(issueName) {
  log(`Starting automation for: ${issueName}`)

  return new Promise((resolve) => {
    const child = spawn("node", ["src/index.js", "--issue", issueName], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        RESULTS_MODE: "false",
        HEADLESS_MODE: "new",
      },
      stdio: "pipe",
    })

    let output = ""

    child.stdout.on("data", (data) => {
      output += data.toString()
      process.stdout.write(data)
    })

    child.stderr.on("data", (data) => {
      output += data.toString()
      process.stderr.write(data)
    })

    child.on("close", (code) => {
      const success = code === 0
      log(
        success
          ? `Automation completed successfully for: ${issueName}`
          : `Automation failed (exit code ${code}) for: ${issueName}`
      )
      resolve({ success, output, exitCode: code })
    })

    child.on("error", (err) => {
      log(`Spawn error for ${issueName}: ${err.message}`)
      resolve({ success: false, output: err.message, exitCode: -1 })
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")

  log("═══════════════════════════════════════════")
  log("  MEROSHARE IPO AUTO-RUNNER")
  log(isDryRun ? "  MODE: DRY RUN (preview only)" : "  MODE: LIVE")
  log("═══════════════════════════════════════════")

  if (!fs.existsSync(ENV_FILE)) {
    log("No .env file found. Please configure credentials first.")
    log(`Copy config/.env.example to .env and fill in your details.`)
    process.exit(1)
  }

  const { openIpos } = await fetchOpenIpos()

  if (openIpos.length === 0) {
    log("No open IPOs at the moment. Nothing to do.")
    return
  }

  const state = loadState()

  const newIpos = openIpos.filter((ipo) => {
    const key = `${(ipo.company_name || "").toLowerCase()}::${ipo.issue_open_date || ""}`
    return !state.automation_triggered_by_issue[key]
  })

  if (newIpos.length === 0) {
    log("All open IPOs have already been processed.")
    return
  }

  log(`Found ${newIpos.length} new open IPO(s) to apply for:`)
  for (const ipo of newIpos) {
    log(`   • ${ipo.company_name} (${ipo.issue_type || "IPO"})`)
    log(`     Open: ${ipo.issue_open_date} → Close: ${ipo.issue_close_date}`)
  }

  if (isDryRun) {
    log("\n DRY RUN — no automation will be triggered.")
    return
  }

  for (const ipo of newIpos) {
    const issueName = (ipo.company_name || "").trim()
    if (!issueName) {
      log("Skipping IPO with missing company_name")
      continue
    }

    const key = `${issueName.toLowerCase()}::${ipo.issue_open_date || ""}`

    log(`\n${"─".repeat(50)}`)
    syncTargetIssueInEnv(issueName)
    const result = await runAutomation(issueName)

    state.automation_triggered_by_issue[key] = {
      triggered_at: new Date().toISOString(),
      company: issueName,
      success: result.success,
      exit_code: result.exitCode,
    }

    saveState(state)

    // Wait between IPOs
    if (newIpos.indexOf(ipo) < newIpos.length - 1) {
      log("Waiting 5s before next IPO...")
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  log("\n═══════════════════════════════════════════")
  log("  AUTO-RUNNER COMPLETE")
  log("═══════════════════════════════════════════")
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`)
  process.exit(1)
})
