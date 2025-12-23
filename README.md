# MeroShare ASBA Automation

Enterprise-grade, production-ready automation for MeroShare ASBA (Application Supported by Blocked Amount) applications with multi-account support.

## Key Features

- **Multi-Account Support**: Process multiple MeroShare accounts in a single run
- **Intelligent Form Handling**: Auto-reads minimum quantity, validates kitta, handles Select2 dropdowns
- **Production Ready**: Robust error handling, retry logic, comprehensive logging
- **Secure by Design**: Credentials masked in logs, no data leaks
- **Executable Binary**: Distribute to users without exposing source code
- **Detailed Reporting**: Success/failure summary with reference IDs

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [How It Works](#how-it-works)
4. [Building Executable](#building-executable-binary)
5. [Distribution Guide](#distribution-guide)
6. [Troubleshooting](#troubleshooting)
7. [Security](#security)
8. [Server Deployment](#server-deployment)

---

## Quick Start

### Option 1: Run with Node.js

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp config/.env.example .env
nano .env  # Edit with your credentials

# 3. Run
npm start

# Debug mode (visible browser)
npm run dev
```

### Option 2: Use Pre-built Binary

```bash
# 1. Download the binary for your OS

# 2. Create .env file in same directory
# The binary will auto-create .env from template on first run

# 3. Edit .env with your credentials
nano .env

# 4. Run
./meroshare-asba        # Linux/Mac
meroshare-asba.exe      # Windows
```

---

## Configuration

### Single Account Mode

For one MeroShare account, set these in `.env`:

```env
MEROSHARE_USERNAME=your_username
MEROSHARE_PASSWORD=your_password
MEROSHARE_DP_NAME=NABIL INVESTMENT BANKING LTD.
TARGET_ISSUE_NAME=Citizens Santulit Yojana
APPLIED_KITTA=10
CRN_NUMBER=your_crn
TRANSACTION_PIN=1234
```

### Multi-Account Mode

For multiple accounts, use the `ACCOUNTS` JSON array:

```env
ACCOUNTS=[{"username":"user1","password":"pass1","dpName":"NABIL INVESTMENT BANKING LTD.","transactionPin":"1234","crnNumber":"CRN001","appliedKitta":10},{"username":"user2","password":"pass2","dpName":"Global IME Capital Ltd.","transactionPin":"5678","crnNumber":"CRN002","appliedKitta":20}]
TARGET_ISSUE_NAME=Citizens Santulit Yojana
```

**Note**: When `ACCOUNTS` is set, it overrides single account settings.

### Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MEROSHARE_USERNAME` | Yes* | Login username |
| `MEROSHARE_PASSWORD` | Yes* | Login password |
| `MEROSHARE_DP_NAME` | Yes* | Exact DP name from dropdown |
| `TARGET_ISSUE_NAME` | Yes | IPO/FPO name (partial match supported) |
| `APPLIED_KITTA` | Yes* | Number of shares (must be >= minimum quantity) |
| `CRN_NUMBER` | Yes* | Bank CRN number |
| `TRANSACTION_PIN` | Yes* | 4-digit PIN |
| `ACCOUNTS` | No | JSON array for multi-account |
| `HEADLESS_MODE` | No | `true`=background, `false`=visible browser |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, `debug` |
| `SCREENSHOT_ON_ERROR` | No | Capture screenshots on failure |

*Required for single account mode; included in each account object for multi-account mode.

### Important Notes

1. **DP Name**: Must match EXACTLY as shown in MeroShare dropdown (copy-paste recommended)
2. **Applied Kitta**: Must be >= minimum quantity set by the issue (usually 10, 50, or 100)
3. **Target Issue**: Partial matching supported - "Citizens" will match "Citizens Santulit Yojana"
4. **Transaction PIN**: Exactly 4 digits

---

## How It Works

### Automation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  For each account:                                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Launch Browser      → Puppeteer with stealth mode           │
│  2. Navigate to Login   → meroshare.cdsc.com.np                 │
│  3. Select DP           → Select2 dropdown interaction          │
│  4. Enter Credentials   → Username & password                   │
│  5. Submit Login        → Wait for dashboard                    │
│  6. Go to ASBA          → Navigate to My ASBA page              │
│  7. Find Target Issue   → Fuzzy match issue name                │
│  8. Click Apply         → Open application form                 │
│  9. Read Min Quantity   → Validate kitta >= minimum             │
│  10. Select Bank        → Native dropdown                       │
│  11. Select Account     → Bank account number                   │
│  12. Enter Kitta        → Number of shares                      │
│  13. Enter CRN          → Bank reference number                 │
│  14. Accept Disclaimer  → Checkbox                              │
│  15. Click Proceed      → Step 1 submission                     │
│  16. Enter PIN          → 4-digit transaction PIN               │
│  17. Click Apply        → Final submission                      │
│  18. Capture Result     → Success/error message                 │
│  19. Close Browser      → Cleanup                               │
├─────────────────────────────────────────────────────────────────┤
│  Generate Summary Report                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Success Output Example

```
================================================================
  MEROSHARE ASBA AUTOMATION
================================================================
  Mode: MULTI-ACCOUNT
  Total Accounts: 2
  Headless: false
  Screenshots: Enabled
================================================================

[Account 1/2] Processing: use***
[Account 1/2] DP: NABIL INVESTMENT BANKING LTD.
[Account 1/2] Target: Citizens Santulit Yojana
[Account 1/2] Kitta: 10
[Account 1/2] Starting browser...
[Account 1/2] Browser ready
[Account 1/2] Logging in...
[Account 1/2] Login successful
[Account 1/2] Navigating to ASBA page...
[Account 1/2] ASBA page loaded
[Account 1/2] Searching for: Citizens Santulit Yojana
[Account 1/2] Found issue: Citizens Santulit Yojana
[Account 1/2] Filling application form...
[Account 1/2] Minimum quantity for this issue: 10
[Account 1/2] Kitta validation passed: 10 >= 10
[Account 1/2] Bank selected: NABIL BANK LIMITED
[Account 1/2] Account selected: 03910017512508 - SAVING ACCOUNT
[Account 1/2] Calculated amount: Rs. 100
[Account 1/2] Form filled
[Account 1/2] Submitting application...
[Account 1/2] SUCCESS: Application submitted!
[Account 1/2] Reference: 12345678

================================================================
  EXECUTION SUMMARY
================================================================
  Total Processed: 2
  Successful: 2
  Failed: 0
----------------------------------------------------------------
  [OK] use*** (NABIL INVESTMENT BANKING LTD.)
        Reference: 12345678
        Issue: Citizens Santulit Yojana, Kitta: 10
  [OK] ano*** (Global IME Capital Ltd.)
        Reference: 87654321
        Issue: Citizens Santulit Yojana, Kitta: 10
================================================================

All applications submitted successfully!
```

---

## Building Executable Binary

Users receive only the binary and `.env.example` - no source code exposed.

### Prerequisites

```bash
# Install pkg globally
npm install -g @yao-pkg/pkg
```

### Build Commands

```bash
# Install dependencies first
npm install

# Build for all platforms
npm run build

# Build for specific platform
npm run build:linux   # Linux
npm run build:mac     # macOS
npm run build:win     # Windows

# Output in dist/ folder:
# - meroshare-asba-linux
# - meroshare-asba-macos
# - meroshare-asba-win.exe
```

---

## Distribution Guide

### Creating Distribution Package

```bash
# Create distribution folder
mkdir -p meroshare-asba-v2.1.0
cd meroshare-asba-v2.1.0

# Copy binary (choose your platform)
cp ../dist/meroshare-asba-linux ./meroshare-asba
# OR for Windows:
# cp ../dist/meroshare-asba-win.exe ./meroshare-asba.exe

# Copy configuration template
cp ../config/.env.example ./.env.example

# Create empty folders for user
mkdir screenshots logs

# Create user guide
cat > README.txt << 'EOF'
╔═══════════════════════════════════════════════════════════════════╗
║           MEROSHARE ASBA AUTOMATION - USER GUIDE                   ║
╚═══════════════════════════════════════════════════════════════════╝

SETUP (One-time):
1. Copy .env.example to .env
2. Edit .env with your MeroShare credentials:
   - MEROSHARE_USERNAME: Your login username
   - MEROSHARE_PASSWORD: Your login password
   - MEROSHARE_DP_NAME: Your bank/broker name (EXACT match)
   - TARGET_ISSUE_NAME: IPO/FPO name you want to apply
   - APPLIED_KITTA: Number of shares (must be >= minimum)
   - CRN_NUMBER: Your bank CRN
   - TRANSACTION_PIN: Your 4-digit PIN

RUNNING:
- Windows: Double-click meroshare-asba.exe
- Linux/Mac: Open terminal and run: ./meroshare-asba

MULTI-ACCOUNT:
See ACCOUNTS example in .env.example to apply for multiple accounts.

TROUBLESHOOTING:
- Check screenshots/ folder for error screenshots
- Check logs/ folder for detailed logs
- Set HEADLESS_MODE=false to see the browser

SECURITY:
- Never share your .env file
- Delete screenshots after debugging
- Keep binary and .env in a secure location

EOF

# Create ZIP for distribution
cd ..
zip -r meroshare-asba-v2.1.0.zip meroshare-asba-v2.1.0/
```

### Distribution Package Contents

```
meroshare-asba-v2.1.0/
├── meroshare-asba          # Binary (Linux/Mac)
├── meroshare-asba.exe      # Binary (Windows)
├── .env.example            # Configuration template
├── README.txt              # User instructions
├── screenshots/            # Auto-created on error
└── logs/                   # Auto-created on run
```

### How Users Run It

**First Time:**
```bash
# 1. Extract the ZIP
unzip meroshare-asba-v2.1.0.zip
cd meroshare-asba-v2.1.0

# 2. Create .env from template
cp .env.example .env

# 3. Edit .env with credentials
nano .env  # or any text editor

# 4. Run
./meroshare-asba
```

**Subsequent Runs:**
```bash
cd meroshare-asba-v2.1.0
./meroshare-asba
```

The binary will:
- Auto-create `logs/` and `screenshots/` folders if missing
- Auto-create `.env` from template if missing (and exit asking user to configure)
- Validate all credentials before starting
- Show detailed progress and results

---

## Troubleshooting

### Common Errors and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `DP selection failed` | DP name doesn't match | Copy exact DP name from MeroShare dropdown |
| `Login failed` | Wrong credentials | Verify username/password |
| `Issue not found` | Wrong issue name | Check exact name in MeroShare |
| `Applied kitta is less than minimum` | Kitta too low | Increase `APPLIED_KITTA` to >= minimum |
| `Account selection failed` | No linked bank | Link bank account in MeroShare first |
| `Transaction PIN must be 4 digits` | Invalid PIN | Check PIN is exactly 4 digits |
| `Form incomplete` | Missing required field | Check CRN, kitta, bank selection |

### Debug Mode

Run with visible browser and verbose logging:

```bash
# Using npm
npm run dev

# Using binary
HEADLESS_MODE=false LOG_LEVEL=debug ./meroshare-asba
```

### Check Error Screenshots

When errors occur, screenshots are saved to `screenshots/` folder:
- `form-error-1703275200000.png` - Form filling errors
- `submit-error-1703275200000.png` - Submission errors
- `error-1703275200000.png` - General errors

---

## Security

### What Gets Protected

- **Passwords**: Masked in all logs (`***`)
- **PINs**: Masked in all logs (`****`)
- **CRN**: Masked in all logs (`***`)
- **Usernames**: Partially shown (`use***`)

### Log Output Example

```
[info] Entering username...
[debug] Username entered: use***
[debug] Password entered: ***
[info] Selecting DP: NABIL INVESTMENT BANKING LTD.
[debug] PIN entered: ****
[debug] CRN entered: ***
```

### Security Best Practices

1. **Never commit `.env` to git** - add to `.gitignore`
2. **Use strong passwords** for MeroShare
3. **Keep binary secure** - treat like your credentials
4. **Delete screenshots** after debugging
5. **Don't share logs** without reviewing for sensitive data

---

## Server Deployment

### Running as Cron Job (Linux)

```bash
# Edit crontab
crontab -e

# Run daily at 10:00 AM
0 10 * * * cd /path/to/meroshare-asba && ./meroshare-asba >> /var/log/meroshare.log 2>&1
```

### Running with PM2

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ./meroshare-asba --name meroshare

# Run on schedule (10 AM daily)
pm2 start ./meroshare-asba --name meroshare --cron "0 10 * * *"

# Save configuration
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-slim

# Install Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Create required directories
RUN mkdir -p logs screenshots

CMD ["node", "src/index.js"]
```

```bash
# Build and run
docker build -t meroshare-asba .
docker run --env-file .env meroshare-asba
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All applications successful |
| 1 | Some applications failed |
| 2 | All applications failed or fatal error |

---

## Project Structure

```
meroshare-asba-automation/
├── src/
│   ├── index.js              # Entry point (multi-account orchestrator)
│   ├── config/
│   │   ├── config.js         # Configuration loader & validator
│   │   └── constants.js      # Selectors, URLs, timeouts
│   ├── core/
│   │   ├── browser.js        # Puppeteer browser management
│   │   ├── login.js          # Authentication (Select2 DP handling)
│   │   ├── issue-detector.js # Issue discovery & fuzzy matching
│   │   └── form-automation.js# Form filling & two-step submission
│   ├── errors/
│   │   ├── error-classifier.js
│   │   └── error-handler.js
│   ├── monitoring/
│   │   ├── network-monitor.js
│   │   └── screenshot.js
│   ├── notifications/
│   │   └── notifier.js       # Webhook notifications
│   ├── security/
│   │   └── sanitizer.js      # Log sanitization
│   └── utils/
│       ├── helpers.js
│       └── logger.js         # Winston logger
├── config/
│   └── .env.example          # Configuration template
├── screenshots/              # Error screenshots (auto-created)
├── logs/                     # Execution logs (auto-created)
├── dist/                     # Built binaries
├── package.json
└── README.md
```

---

## License

MIT License - Use at your own risk.

---

## Disclaimer

This tool is for personal use to automate your own MeroShare applications. Users are responsible for:

- Using only their own accounts
- Complying with MeroShare Terms of Service
- Ensuring legal compliance in their jurisdiction
- Keeping credentials secure

The automation **stops immediately** if it detects:
- CAPTCHA challenges
- OTP verification requests
- Account lockout warnings

These require manual intervention and indicate security measures that should not be bypassed.
