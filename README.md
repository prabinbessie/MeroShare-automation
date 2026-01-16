# MeroShare Automation
Automate your MeroShare IPO/FPO ASBA applications with ease using  this secure Puppeteer-based tool. Designed for both single and multi-account usage, it handles dynamic form elements, validations, and error scenarios to ensure smooth submissions.

## Key Features

- **Multi-Account Support**: Process multiple MeroShare accounts in a single run
- **Intelligent Form Handling**: Auto-reads minimum quantity, validates kitta, handles dropdowns
- **Production Ready**: error handling, retry logic, comprehensive logging
- **Secure by Design**: Credentials masked in logs, no data leaks
- **Detailed Reporting**: Success/failure summary with reference IDs
- **Result Scraping**: Automatically checks and reports allotment results post-application smartly into json file



## Quick Start

```bash
# Clone repository
git clone https://github.com/prabinbessie/MeroShare-automation.git
cd MeroShare-automation

# 1. Install dependencies
npm install

# 2. Configure credentials
cp config/.env.example .env
nano .env  # Edit with your credentials

# 3. Run
npm start

# Debug mode (visible browser if set false in .env )
npm run dev
```

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
RESULTS_MODE=false
```

### Multiple -Account Mode

For multiple accounts, use the `ACCOUNTS` JSON array:

```env
ACCOUNTS=[{"username":"user1","password":"pass1","dpName":"NABIL INVESTMENT BANKING LTD.","transactionPin":"1234","crnNumber":"CRN001","appliedKitta":10},{"username":"user2","password":"pass2","dpName":"Global IME Capital Ltd.","transactionPin":"5678","crnNumber":"CRN002","appliedKitta":20}]
TARGET_ISSUE_NAME=Citizens Santulit Yojana
```

**Note**: When `ACCOUNTS` is set, it overrides single account settings.

## How It Works

### Automation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  For each account:                                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Launch Browser      → Puppeteer with stealth mode           │
│  2. Navigate to Login   → meroshare.cdsc.com.np                 │
│  3. Select DP           → Select dropdown interaction          │
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


---

## Security

### What Gets Protected

- **Passwords**: Masked in all logs (`***`)
- **PINs**: Masked in all logs (`****`)
- **CRN**: Masked in all logs (`***`)
- **Usernames**: Partially shown (`use***`)
- **Screenshots**: Stored locally, not uploaded anywhere

## Run with Docker

1. Pull the Docker image:
   ```bash
   docker pull prabin777/meroshare-automation:latest
   ```

---


## Project Structure

```
meroshare-automation/
├── src/
│   ├── index.js              
│   ├── config/
│   │   ├── config.js         
│   │   └── constants.js      
│   ├── core/
│   │   ├── browser.js        
│   │   ├── login.js          
│   │   ├── issue-detector.js 
│   │   └── form-automation.js
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
├── screenshots/              
├── logs/                     
├── dist/                     
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



 > Failure to adhere to these guidelines may result in account suspension or legal consequences. The author is not liable for misuse of this tool.