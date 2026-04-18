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
 *   node src/bridge/auto-runner.js --setup   # Install startup service (Mac/Windows)
 */

import fs from "fs"
import path from "path"
import { execSync, spawn } from "child_process"
import { fileURLToPath } from "url"
import os from "os"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "../..")

const IPO_FEED_URL =
  "https://raw.githubusercontent.com/prabinbessie/scrappy/dev/data/ipo/ipo_feed.json"

const STATE_FILE = path.join(PROJECT_ROOT, "bridge-data", "state.json")
const LOG_FILE = path.join(PROJECT_ROOT, "autorun.log")

// ── Logging ──

function log(msg) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}`
  console.log(line)
  try {
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
  log(`🚀 Starting automation for: ${issueName}`)

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

function setupMacLaunchd() {
  const plistName = "com.meroshare.autorunner"
  const plistPath = path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${plistName}.plist`
  )

  const nodePath = execSync("which node").toString().trim()

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${plistName}</string>
  
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${path.join(PROJECT_ROOT, "src/bridge/auto-runner.js")}</string>
  </array>
  
  <key>WorkingDirectory</key>
  <string>${PROJECT_ROOT}</string>
  
  <!-- Run daily at 10:30 AM NPT (4:45 UTC) -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>10</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  
  <!-- Also run once at login -->
  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${path.join(PROJECT_ROOT, "logs/autorun-stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(PROJECT_ROOT, "logs/autorun-stderr.log")}</string>
  
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>`

  fs.mkdirSync(path.dirname(plistPath), { recursive: true })
  fs.writeFileSync(plistPath, plistContent)

  // Load the service
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "pipe" })
  } catch {
    // ignore if not loaded
  }
  execSync(`launchctl load "${plistPath}"`)

  log(`macOS LaunchAgent installed at: ${plistPath}`)
  log("   The automation will run:")
  log("   - Once when you log in")
  log("   - Daily at 10:30 AM")
  log(`   To uninstall: launchctl unload "${plistPath}" && rm "${plistPath}"`)
}

function setupWindowsTaskScheduler() {
  const taskName = "MeroShareAutoRunner"
  const nodePath = execSync("where node").toString().trim().split("\n")[0].trim()
  const scriptPath = path.join(PROJECT_ROOT, "src/bridge/auto-runner.js")

  const createCmd = [
    "schtasks",
    "/Create",
    "/TN",
    `"${taskName}"`,
    "/TR",
    `"${nodePath} ${scriptPath}"`,
    "/SC",
    "DAILY",
    "/ST",
    "10:30",
    "/F",
  ].join(" ")

  const logonCmd = [
    "schtasks",
    "/Create",
    "/TN",
    `"${taskName}_AtLogon"`,
    "/TR",
    `"${nodePath} ${scriptPath}"`,
    "/SC",
    "ONLOGON",
    "/F",
  ].join(" ")

  try {
    execSync(createCmd, { stdio: "pipe" })
    execSync(logonCmd, { stdio: "pipe" })
    log(`✅ Windows Task Scheduler tasks created: ${taskName}`)
    log("   The automation will run:")
    log("   - Once when you log in")
    log("   - Daily at 10:30 AM")
    log(`   To uninstall: schtasks /Delete /TN "${taskName}" /F && schtasks /Delete /TN "${taskName}_AtLogon" /F`)
  } catch (err) {
    log(`Failed to create Windows task. Try running as Administrator.`)
    log(`   Error: ${err.message}`)
  }
}

function runSetup() {
  log("═══════════════════════════════════════════")
  log("  MEROSHARE AUTO-RUNNER SETUP")
  log("═══════════════════════════════════════════")

  const platform = os.platform()

  if (platform === "darwin") {
    log("Detected: macOS — Installing LaunchAgent...")
    setupMacLaunchd()
  } else if (platform === "win32") {
    log("Detected: Windows — Installing Task Scheduler...")
    setupWindowsTaskScheduler()
  } else {
    log(`Unsupported platform: ${platform}`)
    log("For Linux, add to crontab manually:")
    log(`  crontab -e`)
    log(`  # Add: 30 10 * * * cd ${PROJECT_ROOT} && node src/bridge/auto-runner.js`)
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")
  const isSetup = args.includes("--setup")

  if (isSetup) {
    runSetup()
    return
  }

  log("═══════════════════════════════════════════")
  log("  MEROSHARE IPO AUTO-RUNNER")
  log(isDryRun ? "  MODE: DRY RUN (preview only)" : "  MODE: LIVE")
  log("═══════════════════════════════════════════")

  const envPath = path.join(PROJECT_ROOT, ".env")
  if (!fs.existsSync(envPath)) {
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
    const issueName = ipo.company_name
    const key = `${issueName.toLowerCase()}::${ipo.issue_open_date || ""}`

    log(`\n${"─".repeat(50)}`)
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
