/**
 * Data Sanitization
 *
 * Masks sensitive data in logs and outputs
 */

const SENSITIVE_FIELDS = ["password", "token", "secret", "key", "credential", "pin", "crn", "otp", "auth", "bearer"]

export function sanitize(data) {
  if (typeof data !== "object" || data === null) {
    return data
  }

  const sanitized = Array.isArray(data) ? [] : {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field)) //check if key is sensitive

    if (isSensitive) {
      sanitized[key] = "***REDACTED***"
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitize(value)
    } else if (typeof value === "string" && looksLikeSensitive(value)) {
      sanitized[key] = maskString(value, 4) //mask all but first 4 chars
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function maskString(str, visibleChars = 4) {
  if (!str || str.length <= visibleChars) {
    return "***"
  }
  return str.slice(0, visibleChars) + "***"
}

function looksLikeSensitive(value) {
  //Don't mask short values or. the url
  if (!value || value.length < 8 || value.startsWith("http")) {
    return false
  }

  // Check for patterns that look like secrets
  const patterns = [
    /^[A-Za-z0-9]{32,}$/, // Long alphanumeric strings
    /^[A-Za-z0-9+/=]{20,}$/, // Base64 encoded data
    /^sk_[a-z]+_[A-Za-z0-9]+$/, //Stripe-style keys
    /^ghp_[A-Za-z0-9]+$/, // GitHub tokens
  ]

  return patterns.some((p) => p.test(value))
}

export function sanitizeUrl(url) {
  try {
    const urlObj = new URL(url)
    const sensitiveParams = ["token", "key", "secret", "password", "auth"]
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "***REDACTED***")
      }
    })
    return urlObj.toString()
  } catch {
    return url
  }
}
