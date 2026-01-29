/**
 * Email Service - Handles sending emails via Resend
 *
 * Falls back to console logging if RESEND_API_KEY is not configured.
 * This allows development without email credentials.
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

class EmailService {
  private apiKey: string | undefined
  private fromEmail: string

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY
    this.fromEmail = process.env.FROM_EMAIL || "noreply@equinet.se"
  }

  private get isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== "your-resend-api-key"
  }

  async send(options: EmailOptions): Promise<SendResult> {
    // Log all emails in development or when not configured
    console.log("=== EMAIL ===")
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log(`From: ${this.fromEmail}`)

    if (!this.isConfigured) {
      console.log("--- EMAIL CONTENT (mock mode - RESEND_API_KEY not configured) ---")
      console.log(options.text || options.html)
      console.log("=== END EMAIL ===")
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      }
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Email send failed:", error)
        return {
          success: false,
          error: error.message || "Failed to send email",
        }
      }

      const data = await response.json()
      console.log(`Email sent successfully: ${data.id}`)
      console.log("=== END EMAIL ===")

      return {
        success: true,
        messageId: data.id,
      }
    } catch (error) {
      console.error("Email send error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

// Singleton instance
export const emailService = new EmailService()

// --- Email Verification Notification ---
import { emailVerificationEmail } from "./templates"

/**
 * Send email verification notification
 *
 * @param email - Recipient email
 * @param firstName - User's first name
 * @param token - Verification token
 */
export async function sendEmailVerificationNotification(
  email: string,
  firstName: string,
  token: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`

  const { html, text } = emailVerificationEmail({
    firstName,
    verificationUrl,
  })

  return await emailService.send({
    to: email,
    subject: "Verifiera din e-post - Equinet",
    html,
    text,
  })
}
