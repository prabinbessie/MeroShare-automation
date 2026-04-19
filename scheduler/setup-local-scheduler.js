#!/usr/bin/env node

/**
 * Local Scheduler Setup
 *
 * Sets up automatic background execution for the IPO auto-runner:
 * - macOS: launchd LaunchAgent
 * - Windows: Task Scheduler
 *
 * It also runs the job once immediately after setup to validate the pipeline.
 */

import fs from "fs"
import path from "path"
import os from "os"
import { execSync, spawnSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")

const RUNNER_SCRIPT = path.join(PROJECT_ROOT, "src", "bridge", "auto-runner.js")
const SETUP_LOG_FILE = path.join(PROJECT_ROOT, "logs", "autorun-setup.log")

const DEFAULT_TIME = "10:30"
const WINDOWS_TASK_NAME = "MeroShareAutoRunner"
const MAC_PLIST_NAME = "com.meroshare.autorunner"

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)
  try {
    fs.mkdirSync(path.dirname(SETUP_LOG_FILE), { recursive: true })
    fs.appendFileSync(SETUP_LOG_FILE, `${line}\n`)
  } catch {
    // best-effort setup logging
  }
}

function printUsage() {
  console.log("Usage: node scheduler/setup-local-scheduler.js [options]")
  console.log("")
  console.log("Options:")
  console.log("  --dry-run       Schedule dry-run mode instead of live apply")
  console.log("  --time HH:MM    Daily run time in 24h format (default: 10:30)")
  console.log("  --help          Show this help")
}

function parseArgs(rawArgs) {
  const options = {
    dryRun: false,
    time: DEFAULT_TIME,
    help: false,
  }

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--time") {
      const candidate = rawArgs[i + 1]
      if (!candidate) {
        throw new Error("Missing value for --time. Expected HH:MM")
      }
      options.time = candidate
      i += 1
      continue
    }

    if (arg.startsWith("--time=")) {
      options.time = arg.split("=")[1]
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function validateTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) {
    return false
  }

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function getNodePath() {
  const lookup = process.platform === "win32" ? "where node" : "which node"
  const output = execSync(lookup).toString().split(/\r?\n/).find((line) => line.trim())

  if (!output) {
    throw new Error("Node.js executable not found in PATH")
  }

  return output.trim()
}

function getRunnerArgs(dryRun) {
  const args = [RUNNER_SCRIPT]
  if (dryRun) {
    args.push("--dry-run")
  }
  return args
}

function installMacScheduler(nodePath, options) {
  const plistPath = path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${MAC_PLIST_NAME}.plist`
  )

  const [hourText, minuteText] = options.time.split(":")
  const hour = Number.parseInt(hourText, 10)
  const minute = Number.parseInt(minuteText, 10)
  const runnerArgs = getRunnerArgs(options.dryRun)

  const argXml = [nodePath, ...runnerArgs].map((value) => `    <string>${value}</string>`).join("\n")

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAC_PLIST_NAME}</string>

  <key>ProgramArguments</key>
  <array>
${argXml}
  </array>

  <key>WorkingDirectory</key>
  <string>${PROJECT_ROOT}</string>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${path.join(PROJECT_ROOT, "logs", "autorun-stdout.log")}</string>

  <key>StandardErrorPath</key>
  <string>${path.join(PROJECT_ROOT, "logs", "autorun-stderr.log")}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>`

  fs.mkdirSync(path.dirname(plistPath), { recursive: true })
  fs.writeFileSync(plistPath, plistContent)

  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "pipe" })
  } catch {
    // no existing service to unload
  }

  execSync(`launchctl load "${plistPath}"`)
  log(`macOS LaunchAgent installed: ${plistPath}`)
  log(`Run schedule: daily at ${options.time} + at login (RunAtLoad=true)`)
}

function installWindowsScheduler(nodePath, options) {
  const runnerArgs = getRunnerArgs(options.dryRun)
  const runnerCommand = `\\"${nodePath}\\" ${runnerArgs.map((arg) => `\\"${arg}\\"`).join(" ")}`

  const dailyCmd = [
    "schtasks",
    "/Create",
    "/TN",
    `\"${WINDOWS_TASK_NAME}\"`,
    "/TR",
    `\"${runnerCommand}\"`,
    "/SC",
    "DAILY",
    "/ST",
    options.time,
    "/F",
  ].join(" ")

  const logonCmd = [
    "schtasks",
    "/Create",
    "/TN",
    `\"${WINDOWS_TASK_NAME}_AtLogon\"`,
    "/TR",
    `\"${runnerCommand}\"`,
    "/SC",
    "ONLOGON",
    "/F",
  ].join(" ")

  execSync(dailyCmd, { stdio: "pipe" })
  execSync(logonCmd, { stdio: "pipe" })

  log(`Windows tasks installed: ${WINDOWS_TASK_NAME}, ${WINDOWS_TASK_NAME}_AtLogon`)
  log(`Run schedule: daily at ${options.time} + at user logon`)
}

function runOnceNow(nodePath, dryRun) {
  const args = getRunnerArgs(dryRun)
  log(`Running one immediate ${dryRun ? "dry" : "live"} execution for verification...`)

  const result = spawnSync(nodePath, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(`Immediate execution failed with exit code ${result.status}`)
  }

  log("Immediate verification run completed successfully.")
}

function ensurePrerequisites() {
  if (!fs.existsSync(RUNNER_SCRIPT)) {
    throw new Error(`Runner script not found: ${RUNNER_SCRIPT}`)
  }

  const envPath = path.join(PROJECT_ROOT, ".env")
  if (!fs.existsSync(envPath)) {
    throw new Error(".env file is missing. Create it from config/.env.example before setup.")
  }
}

function printSummary(options) {
  log("Scheduler setup finished.")
  log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE APPLY"}`)
  log(`Daily schedule: ${options.time}`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  if (!validateTime(options.time)) {
    throw new Error(`Invalid --time value: ${options.time}. Expected HH:MM (24h).`)
  }

  ensurePrerequisites()

  const nodePath = getNodePath()
  const platform = os.platform()

  log("==========================================")
  log("MeroShare Local Scheduler Setup")
  log(`Platform: ${platform}`)
  log(`Node: ${nodePath}`)
  log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE APPLY"}`)
  log("==========================================")

  if (platform === "darwin") {
    installMacScheduler(nodePath, options)
  } else if (platform === "win32") {
    installWindowsScheduler(nodePath, options)
  } else {
    throw new Error(`Unsupported platform: ${platform}. Use macOS or Windows.`)
  }

  runOnceNow(nodePath, options.dryRun)
  printSummary(options)
}

try {
  main()
} catch (error) {
  log(`Setup failed: ${error.message}`)
  process.exit(1)
}
