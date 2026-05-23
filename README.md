# MeroShare Automation

Automate IPO applications on MeroShare for single or multiple accounts with scheduling support.

Built with Puppeteer + stealth mode. Handles Select2 dropdowns, Angular wizard forms, fuzzy issue matching, and multi-account sequential runs

## Features

- **Multi-account**: Process multiple MeroShare accounts in one run
- **Fuzzy issue matching**: Finds the right IPO even with partial name
- **Auto-scheduler**: macOS LaunchAgent / Windows Task Scheduler with auto-detect flow
- **Result scraping**: Checks allotment results and saves to `logs/application-results.json`
- **Safe logging**: Credentials masked in all output

## Requirements

- Node.js >= 18
- npm >= 8

## Quick Start

```bash
git clone https://github.com/prabinbessie/MeroShare-automation.git
cd MeroShare-automation
npm install
cp config/.env.example .env
# Edit .env with your credentials
npm start
```

`npm run dev` — runs with visible browser (sets `HEADLESS_MODE=false` via env).

## Configuration

### Single Account

```env
MEROSHARE_USERNAME=your_username
MEROSHARE_PASSWORD=your_password
MEROSHARE_DP_NAME=NABIL INVESTMENT BANKING LTD.
TARGET_ISSUE_NAME=Citizens Santulit Yojana
APPLIED_KITTA=10
CRN_NUMBER=your_crn
TRANSACTION_PIN=1234
HEADLESS_MODE=true
RESULTS_MODE=false
```

`MEROSHARE_DP_NAME` must match exactly as shown on the MeroShare login page.

### Multiple Accounts

Use the `ACCOUNTS` JSON array. When set, it overrides single-account env var

```env
# Same issue for all accounts — set globally:
TARGET_ISSUE_NAME=Citizens Santulit Yojana
ACCOUNTS=[
  {"username":"user1","password":"pass1","dpName":"NABIL INVESTMENT BANKING LTD.","transactionPin":"1234","crnNumber":"CRN001","appliedKitta":10},
  {"username":"user2","password":"pass2","dpName":"Global IME Capital Ltd.","transactionPin":"5678","crnNumber":"CRN002","appliedKitta":20}
]
```

```env
# Different issue per account — use targetIssueName per entry:
ACCOUNTS=[
  {"username":"user1","password":"pass1","dpName":"NABIL INVESTMENT BANKING LTD.","transactionPin":"1234","crnNumber":"CRN001","appliedKitta":10,"targetIssueName":"Citizens Santulit Yojana"},
  {"username":"user2","password":"pass2","dpName":"Global IME Capital Ltd.","transactionPin":"5678","crnNumber":"CRN002","appliedKitta":20,"targetIssueName":"Prabhu Life Insurance"}
]
```

`targetIssueName` per account overrides the global `TARGET_ISSUE_NAME`.

## Scheduler (macOS + Windows)

Installs a background schedule that fetches the IPO feed and triggers the apply flow automatically.

```bash
# Install and start
npm run auto:setup

# Dry run — fetch only, no application submitted
npm run auto:setup -- --dry-run

# Custom daily time ( your preferred time in 24h format, e.g. 09:45 )
npm run auto:setup -- --time 09:45
```

**Flow:** Fetch IPO feed → find new open issues → apply for each → save state to avoid duplicate runs.

**State files:**
- `bridge-data/state.json` — processed issue tracker
- `logs/autorun.log` — scheduler run log

**Uninstall:**

```bash
# macOS
launchctl unload ~/Library/LaunchAgents/com.meroshare.autorunner.plist
rm ~/Library/LaunchAgents/com.meroshare.autorunner.plist

# Windows
schtasks /Delete /TN "MeroShareAutoRunner" /F
schtasks /Delete /TN "MeroShareAutoRunner_AtLogon" /F
```

## Automation flow

```
For each account:
  1. Launch browser          Puppeteer + stealth plugin
  2. Login                   DP dropdown → username → password → submit
  3. Navigate to ASBA        meroshare.cdsc.com.np/#/asba
  4. Find target issue       Fuzzy match on issue name
  5. Open application form
  6. Select bank + account   Waits for account options to load
  7. Enter kitta             Validates against minimum quantity
  8. Enter CRN               Skipped if not configured
  9. Accept disclaimer
  10. Click Proceed          Step 1 → Step 2 wizard transition
  11. Enter transaction PIN
  12. Click Apply            Final submission
  13. Capture result         Reads success/error toast message
  14. Close browser

Print summary report
```

## Docker

```bash
docker pull prabin777/meroshare-automation:latest
docker run --env-file .env prabin777/meroshare-automation:latest
```

Or with docker-compose:

```bash
docker-compose up
```

## Project Structure

```
├── src/
│   ├── index.js                  Entry point
│   ├── config/
│   │   ├── config.js             Env parsing and validation
│   │   └── constants.js          Selectors and timeouts
│   ├── core/
│   │   ├── browser.js            Puppeteer launch + anti-detection
│   │   ├── login.js              Login flow
│   │   ├── issue-detector.js     ASBA page scraping + fuzzy match
│   │   └── form-automation.js    Application form + submission
│   ├── errors/
│   │   ├── error-classifier.js
│   │   └── error-handler.js
│   ├── monitoring/
│   │   ├── network-monitor.js
│   │   └── screenshot.js
│   ├── notifications/
│   │   └── notifier.js
│   ├── security/
│   │   └── sanitizer.js
│   └── utils/
│       ├── helpers.js
│       └── logger.js
├── config/
│   └── .env.example
├── scheduler/
│   └── setup-local-scheduler.js
├── bridge-data/                  Scheduler state
├── screenshots/                  Error screenshots
├── logs/                         Run logs and results
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── package.json
```

## License

MIT — use at your own risk. This tool is for automating your own MeroShare accounts only. The author is not responsible for misuse or account suspension.