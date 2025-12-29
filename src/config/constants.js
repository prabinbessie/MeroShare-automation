/**
 * Application Constants
 *
 * All selectors validated from actual MeroShare HTML structure:
 */

export const URLS = {
  BASE: "https://meroshare.cdsc.com.np",
  LOGIN: "https://meroshare.cdsc.com.np/#/login",
  DASHBOARD: "https://meroshare.cdsc.com.np/#/dashboard",
  ASBA: "https://meroshare.cdsc.com.np/#/asba",
}

export const SELECTORS = {
  LOGIN: {
    DP_CONTAINER: ".select2-container",
    DP_SELECTION: ".select2-selection--single",
    DP_HIDDEN_SELECT: "select.select2-hidden-accessible",
    USERNAME_INPUT: "input#username",
    PASSWORD_INPUT: "input#password",
    SUBMIT_BUTTON: 'button[type="submit"]',
    LOGIN_FORM: "form.login-form, form",
    DASHBOARD_INDICATOR: ".app-body, .sidebar, app-dashboard, .main",
    ERROR_MESSAGE: ".toast-error, .alert-danger, .text-danger",
    TOAST_CONTAINER: "#toast-container",
  },

  //asba page selectors 
  ASBA: {
    PAGE_CONTAINER: "app-asba",
    MAIN_CONTENT: ".main, .main-container",
    COMPANY_LIST: ".company-list",
    COMPANY_NAME: ".company-name span[tooltip='Company Name']",
    COMPANY_TYPE: ".share-of-type",
    APPLY_BUTTON: "button.btn-issue",
  },

  FORM: {
    BANK_SELECT: "select#selectBank",

    ACCOUNT_SELECT: "select#accountNumber",
    BRANCH_INPUT: "input#selectBranch",
    MIN_QUANTITY_LABEL: "label:contains('Minimum Quantity')",
    MIN_QUANTITY_VALUE: ".form-value span",
    KITTA_INPUT: "input#appliedKitta",
    AMOUNT_INPUT: "input#amount",
    CRN_INPUT: "input#crnNumber",
    DISCLAIMER_CHECKBOX: "input#disclaimer",
    TRANSACTION_PIN: "input#transactionPIN",
    PROCEED_BUTTON: 'button.btn-primary[type="submit"]',
    APPLY_BUTTON: 'button.btn-primary[type="submit"]',
  },

  SELECT2: {
    CONTAINER: ".select2-container",
    CONTAINER_OPEN: ".select2-container--open",
    SELECTION: ".select2-selection",
    SELECTION_RENDERED: ".select2-selection__rendered",
    DROPDOWN: ".select2-dropdown",
    SEARCH_FIELD: "input.select2-search__field",
    RESULTS: ".select2-results__options",
    OPTION: ".select2-results__option",
    OPTION_HIGHLIGHTED: ".select2-results__option--highlighted",
  },
  RESULT: {
    SUCCESS_TOAST: ".toast-success",
    ERROR_TOAST: ".toast-error",
    ALERT_SUCCESS: ".alert-success",
    ALERT_DANGER: ".alert-danger",
  },
}

export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 15000,
  LONG: 30000,
  EXTRA_LONG: 60000,
}

export const ERROR_CODES = {
  AUTH_ERROR: {
    code: "AUTH_001",
    category: "Authentication",
    severity: "HIGH",
    retryable: false,
  },
  NAVIGATION_ERROR: {
    code: "NAV_001",
    category: "Navigation",
    severity: "MEDIUM",
    retryable: true,
  },
  SELECTOR_ERROR: {
    code: "SEL_001",
    category: "Selector",
    severity: "HIGH",
    retryable: false,
  },
  FORM_ERROR: {
    code: "FORM_001",
    category: "Form",
    severity: "MEDIUM",
    retryable: true,
  },
  VALIDATION_ERROR: {
    code: "VAL_001",
    category: "Validation",
    severity: "MEDIUM",
    retryable: false,
  },
  BUSINESS_LOGIC_ERROR: {
    code: "BIZ_001",
    category: "Business Logic",
    severity: "MEDIUM",
    retryable: false,
  },
  NETWORK_ERROR: {
    code: "NET_001",
    category: "Network/Server",
    severity: "HIGH",
    retryable: true,
  },
}

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]
