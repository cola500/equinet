/**
 * Input sanitization utilities
 *
 * Protects against XSS, SQL injection, and other common attacks
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 * Keeps: letters, numbers, spaces, and common punctuation
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return ""

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
}

/**
 * Sanitize HTML by escaping dangerous characters
 * Use this for user-generated content that will be displayed
 */
export function escapeHtml(input: string): string {
  if (typeof input !== "string") return ""

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  }

  return input.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") return ""

  return email
    .toLowerCase()
    .trim()
    // Remove any characters that aren't valid in email addresses
    .replace(/[^a-z0-9@._+-]/gi, "")
}

/**
 * Sanitize phone number - keep only digits, spaces, hyphens, parentheses, and plus
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== "string") return ""

  return phone
    .trim()
    .replace(/[^0-9\s\-()+ ]/g, "")
}

/**
 * Sanitize URL - ensure it's a valid HTTP/HTTPS URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== "string") return null

  try {
    const parsed = new URL(url)
    // Only allow HTTP and HTTPS protocols
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Sanitize user input for search queries
 * Prevents SQL injection and malicious searches
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== "string") return ""

  return query
    .trim()
    // Remove SQL injection attempts
    .replace(/['";\\]/g, "")
    // Remove wildcard characters that could cause performance issues
    .replace(/[%*]/g, "")
    // Limit length
    .slice(0, 100)
    // Normalize whitespace
    .replace(/\s+/g, " ")
}

/**
 * Validate and sanitize file names
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== "string") return ""

  return fileName
    .trim()
    // Remove path traversal attempts
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "")
    // Remove dangerous characters
    .replace(/[<>:"|?*\x00-\x1f]/g, "")
    // Limit length
    .slice(0, 255)
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: any): number | null {
  const num = Number(input)
  if (isNaN(num) || !isFinite(num)) {
    return null
  }
  return num
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === "boolean") return input
  if (typeof input === "string") {
    const lower = input.toLowerCase()
    return lower === "true" || lower === "1" || lower === "yes"
  }
  return Boolean(input)
}

/**
 * Remove potential XSS from text content
 * More aggressive than sanitizeString - use for untrusted HTML
 */
export function stripXss(input: string): string {
  if (typeof input !== "string") return ""

  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    // Remove javascript: URLs
    .replace(/javascript:/gi, "")
    // Remove data: URLs (can contain base64 encoded scripts)
    .replace(/data:text\/html/gi, "")
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Finally escape remaining HTML
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Comprehensive sanitization for user profile data
 */
export interface SanitizedUserInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  businessName?: string
  description?: string
  address?: string
  city?: string
  postalCode?: string
  serviceArea?: string
}

export function sanitizeUserInput(input: any): SanitizedUserInput {
  return {
    firstName: sanitizeString(input.firstName || ""),
    lastName: sanitizeString(input.lastName || ""),
    email: sanitizeEmail(input.email || ""),
    phone: input.phone ? sanitizePhone(input.phone) : undefined,
    businessName: input.businessName ? sanitizeString(input.businessName) : undefined,
    description: input.description ? sanitizeString(input.description) : undefined,
    address: input.address ? sanitizeString(input.address) : undefined,
    city: input.city ? sanitizeString(input.city) : undefined,
    postalCode: input.postalCode ? sanitizeString(input.postalCode) : undefined,
    serviceArea: input.serviceArea ? sanitizeString(input.serviceArea) : undefined,
  }
}
