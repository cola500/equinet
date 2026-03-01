/**
 * Email Templates - HTML templates for various email notifications
 */

import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"
import { escapeHtml } from "@/lib/sanitize"

/** Alias for escapeHtml -- keeps template interpolations readable */
const e = escapeHtml

interface EmailVerificationData {
  firstName: string
  verificationUrl: string
}

interface BookingConfirmationData {
  customerName: string
  serviceName: string
  providerName: string
  businessName: string
  bookingDate: string
  startTime: string
  endTime: string
  price: number
  bookingId: string
}

interface PaymentConfirmationData {
  customerName: string
  serviceName: string
  providerName: string
  businessName: string
  bookingDate: string
  amount: number
  currency: string
  invoiceNumber: string
  paidAt: string
  bookingId: string
}

interface BookingStatusChangeData {
  customerName: string
  serviceName: string
  providerName: string
  businessName: string
  bookingDate: string
  startTime: string
  newStatus: string
  statusLabel: string
  cancellationMessage?: string
}

interface RebookingReminderData {
  customerName: string
  serviceName: string
  providerName: string
  rebookUrl: string
}

interface BookingReminderData {
  customerName: string
  serviceName: string
  providerName: string
  businessName: string
  bookingDate: string
  startTime: string
  endTime: string
  bookingUrl: string
  unsubscribeUrl: string
}

interface BookingRescheduleData {
  customerName: string
  serviceName: string
  businessName: string
  oldBookingDate: string
  oldStartTime: string
  newBookingDate: string
  newStartTime: string
  newEndTime: string
  bookingUrl: string
  requiresApproval: boolean
}

export interface BookingSeriesCreatedData {
  customerName: string
  serviceName: string
  businessName: string
  totalOccurrences: number
  createdCount: number
  intervalWeeks: number
  bookingDates: { date: string; time: string }[]
  skippedDates?: { date: string; reason: string }[]
}

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .label { color: #6b7280; }
  .value { font-weight: 600; }
  .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  .success-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
`

export function emailVerificationEmail(data: EmailVerificationData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Verifiera din e-post</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p>Tack for att du registrerade dig pa Equinet. Klicka pa knappen nedan for att verifiera din e-postadress.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.verificationUrl)}" class="button" style="font-size: 16px;">
        Verifiera e-post
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Lanken ar giltig i 24 timmar. Om du inte registrerade dig pa Equinet kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in folande lank i din webblasare:<br>
      <a href="${e(data.verificationUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.verificationUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform for hasttjanster</p>
  </div>
</body>
</html>
`

  const text = `
Verifiera din e-post

Hej ${data.firstName}!

Tack for att du registrerade dig pa Equinet. Klicka pa lanken nedan for att verifiera din e-postadress:

${data.verificationUrl}

Lanken ar giltig i 24 timmar. Om du inte registrerade dig pa Equinet kan du ignorera detta mail.

--
Equinet - Din plattform for hasttjanster
`

  return { html, text }
}

interface PasswordResetData {
  firstName: string
  resetUrl: string
}

export function passwordResetEmail(data: PasswordResetData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Återställ ditt lösenord</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p>Vi har fått en begäran om att återställa lösenordet för ditt konto på Equinet.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.resetUrl)}" class="button" style="font-size: 16px;">
        Återställ lösenord
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Länken är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in följande länk i din webbläsare:<br>
      <a href="${e(data.resetUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.resetUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Återställ ditt lösenord

Hej ${data.firstName}!

Vi har fått en begäran om att återställa lösenordet för ditt konto på Equinet.

Klicka på länken nedan för att välja ett nytt lösenord:

${data.resetUrl}

Länken är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta mail.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function bookingConfirmationEmail(data: BookingConfirmationData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Bokningsbekräftelse</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>Din bokning har mottagits och väntar på bekräftelse från leverantören.</p>

    <h3>Bokningsdetaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${e(data.bookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${e(data.startTime)} - ${e(data.endTime)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Pris:</span>
      <span class="value">${data.price} kr</span>
    </div>

    <p style="margin-top: 20px;">Du kommer att få ett meddelande när leverantören har bekräftat din bokning.</p>

    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings" class="button">
      Se dina bokningar
    </a>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
    <p>Boknings-ID: ${e(data.bookingId)}</p>
  </div>
</body>
</html>
`

  const text = `
Bokningsbekräftelse

Hej ${data.customerName}!

Din bokning har mottagits och väntar på bekräftelse från leverantören.

BOKNINGSDETALJER
----------------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum: ${data.bookingDate}
Tid: ${data.startTime} - ${data.endTime}
Pris: ${data.price} kr

Du kommer att få ett meddelande när leverantören har bekräftat din bokning.

Se dina bokningar: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings

Boknings-ID: ${data.bookingId}
--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function paymentConfirmationEmail(data: PaymentConfirmationData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Betalningsbekräftelse</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p><span class="success-badge">Betalning mottagen</span></p>
    <p>Tack för din betalning! Här är ditt kvitto.</p>

    <h3>Kvittouppgifter</h3>
    <div class="detail-row">
      <span class="label">Kvittonummer:</span>
      <span class="value">${e(data.invoiceNumber)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum för tjänst:</span>
      <span class="value">${e(data.bookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Betaldatum:</span>
      <span class="value">${e(data.paidAt)}</span>
    </div>
    <div class="detail-row" style="border-bottom: 2px solid #16a34a;">
      <span class="label" style="font-weight: 600;">Totalt betalt:</span>
      <span class="value" style="font-size: 18px; color: #16a34a;">${data.amount} ${e(data.currency)}</span>
    </div>

    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings" class="button">
      Se dina bokningar
    </a>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
    <p>Boknings-ID: ${e(data.bookingId)}</p>
    <p>Spara detta email som kvitto för din bokföring.</p>
  </div>
</body>
</html>
`

  const text = `
Betalningsbekräftelse

Hej ${data.customerName}!

BETALNING MOTTAGEN

Tack för din betalning! Här är ditt kvitto.

KVITTOUPPGIFTER
---------------
Kvittonummer: ${data.invoiceNumber}
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum för tjänst: ${data.bookingDate}
Betaldatum: ${data.paidAt}
Totalt betalt: ${data.amount} ${data.currency}

Se dina bokningar: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings

Boknings-ID: ${data.bookingId}

Spara detta email som kvitto för din bokföring.
--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function bookingStatusChangeEmail(data: BookingStatusChangeData): { html: string; text: string } {
  const statusColors: Record<string, string> = {
    confirmed: "#16a34a",
    cancelled: "#dc2626",
    completed: "#2563eb",
    no_show: "#f59e0b",
  }

  const statusBgColors: Record<string, string> = {
    confirmed: "#dcfce7",
    cancelled: "#fee2e2",
    completed: "#dbeafe",
    no_show: "#fef3c7",
  }

  const color = statusColors[data.newStatus] || "#6b7280"
  const bgColor = statusBgColors[data.newStatus] || "#f3f4f6"

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Bokningsuppdatering</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>Din bokning har uppdaterats:</p>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background: ${bgColor}; color: ${color}; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: 600;">
        ${e(data.statusLabel)}
      </span>
    </div>

    ${data.newStatus === "cancelled" && data.cancellationMessage ? `
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Meddelande:</strong></p>
      <p style="margin: 4px 0 0; font-size: 14px; color: #333;">${e(data.cancellationMessage)}</p>
    </div>
    ` : ""}

    <h3>Bokningsdetaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${e(data.bookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${e(data.startTime)}</span>
    </div>

    ${data.newStatus === "confirmed" ? `
    <h3 style="margin-top: 20px;">Inför besöket</h3>
    <p style="margin: 8px 0; color: #6b7280;">Se till att följande är på plats:</p>
    <ul style="margin: 8px 0; padding-left: 20px; color: #333;">
      ${PREPARATION_CHECKLIST.map((item) => `<li style="padding: 4px 0;">${item}</li>`).join("\n      ")}
    </ul>
    ` : ""}

    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings" class="button">
      Se dina bokningar
    </a>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const preparationText = data.newStatus === "confirmed" ? `
INFÖR BESÖKET
-------------
Se till att följande är på plats:
${PREPARATION_CHECKLIST.map((item) => `- ${item}`).join("\n")}
` : ""

  const text = `
Bokningsuppdatering

Hej ${data.customerName}!

Din bokning har uppdaterats: ${data.statusLabel}
${data.newStatus === "cancelled" && data.cancellationMessage ? `
Meddelande: ${data.cancellationMessage}
` : ""}
BOKNINGSDETALJER
----------------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum: ${data.bookingDate}
Tid: ${data.startTime}
${preparationText}
Se dina bokningar: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function rebookingReminderEmail(data: RebookingReminderData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Dags att boka igen!</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>Det har gått ett tag sedan du senast använde <strong>${e(data.serviceName)}</strong> hos <strong>${e(data.providerName)}</strong>.</p>
    <p>Vi rekommenderar att du bokar en ny tid för att hålla din häst i bästa skick.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.rebookUrl)}" class="button" style="font-size: 16px;">
        Boka igen
      </a>
    </div>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Dags att boka igen!

Hej ${data.customerName}!

Det har gått ett tag sedan du senast använde ${data.serviceName} hos ${data.providerName}.
Vi rekommenderar att du bokar en ny tid för att hålla din häst i bästa skick.

Boka igen: ${data.rebookUrl}

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function bookingReminderEmail(data: BookingReminderData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Påminnelse: Din bokning imorgon</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>Vi vill påminna dig om att du har en bokning imorgon.</p>

    <h3>Bokningsdetaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${e(data.bookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${e(data.startTime)} - ${e(data.endTime)}</span>
    </div>

    <h3 style="margin-top: 20px;">Inför besöket</h3>
    <p style="margin: 8px 0; color: #6b7280;">Se till att följande är på plats:</p>
    <ul style="margin: 8px 0; padding-left: 20px; color: #333;">
      ${PREPARATION_CHECKLIST.map((item) => `<li style="padding: 4px 0;">${item}</li>`).join("\n      ")}
    </ul>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${e(data.bookingUrl)}" class="button">Se dina bokningar</a>
    </div>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
    <p style="margin-top: 8px;">
      <a href="${e(data.unsubscribeUrl)}" style="color: #6b7280; font-size: 11px;">Avregistrera dig från bokningspåminnelser</a>
    </p>
  </div>
</body>
</html>
`

  const text = `
Påminnelse: Din bokning imorgon

Hej ${data.customerName}!

Vi vill påminna dig om att du har en bokning imorgon.

BOKNINGSDETALJER
----------------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum: ${data.bookingDate}
Tid: ${data.startTime} - ${data.endTime}

INFÖR BESÖKET
-------------
Se till att följande är på plats:
${PREPARATION_CHECKLIST.map((item) => `- ${item}`).join("\n")}

Se dina bokningar: ${data.bookingUrl}

Vill du inte längre få bokningspåminnelser? Avregistrera dig här: ${data.unsubscribeUrl}

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function bookingRescheduleEmail(data: BookingRescheduleData): { html: string; text: string } {
  const statusMessage = data.requiresApproval
    ? "Din ombokning inväntar godkännande från leverantören."
    : "Din ombokning är bekräftad."

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Bokning ombokad</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>${statusMessage}</p>

    <h3>Tidigare tid</h3>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value" style="text-decoration: line-through; color: #9ca3af;">${e(data.oldBookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value" style="text-decoration: line-through; color: #9ca3af;">${e(data.oldStartTime)}</span>
    </div>

    <h3 style="margin-top: 20px;">Ny tid</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${e(data.newBookingDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${e(data.newStartTime)} - ${e(data.newEndTime)}</span>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${e(data.bookingUrl)}" class="button">Se dina bokningar</a>
    </div>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Bokning ombokad

Hej ${data.customerName}!

${statusMessage}

TIDIGARE TID
------------
Datum: ${data.oldBookingDate}
Tid: ${data.oldStartTime}

NY TID
------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum: ${data.newBookingDate}
Tid: ${data.newStartTime} - ${data.newEndTime}

Se dina bokningar: ${data.bookingUrl}

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

export function bookingSeriesCreatedEmail(data: BookingSeriesCreatedData): { html: string; text: string } {
  const intervalLabel = data.intervalWeeks === 1
    ? 'varje vecka'
    : `var ${data.intervalWeeks}:e vecka`

  const dateListHtml = data.bookingDates
    .map(d => `<li>${e(d.date)} kl. ${e(d.time)}</li>`)
    .join('\n')

  const skippedHtml = data.skippedDates && data.skippedDates.length > 0
    ? `
    <div style="background: #fffbeb; border: 1px solid #fbbf24; padding: 12px; border-radius: 6px; margin-top: 15px;">
      <p style="font-weight: 600; color: #92400e; margin: 0 0 8px 0;">Hoppade datum:</p>
      <ul style="margin: 0; padding-left: 20px; color: #92400e;">
        ${data.skippedDates.map(s => `<li>${e(s.date)} - ${e(s.reason)}</li>`).join('\n')}
      </ul>
    </div>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Återkommande bokning skapad!</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.customerName)}!</p>
    <p>Din återkommande bokning har skapats. ${data.createdCount} av ${data.totalOccurrences} bokningar skapades.</p>

    <h3>Detaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${e(data.serviceName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${e(data.businessName)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Intervall:</span>
      <span class="value">${intervalLabel}</span>
    </div>

    <h3>Bokade datum</h3>
    <ul>
      ${dateListHtml}
    </ul>
    ${skippedHtml}

    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings" class="button">
      Se dina bokningar
    </a>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const skippedText = data.skippedDates && data.skippedDates.length > 0
    ? `\nHOPPADE DATUM\n--------------\n${data.skippedDates.map(s => `${s.date} - ${s.reason}`).join('\n')}\n`
    : ''

  const text = `
Återkommande bokning skapad!

Hej ${data.customerName}!

Din återkommande bokning har skapats. ${data.createdCount} av ${data.totalOccurrences} bokningar skapades.

DETALJER
--------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Intervall: ${intervalLabel}

BOKADE DATUM
------------
${data.bookingDates.map(d => `${d.date} kl. ${d.time}`).join('\n')}
${skippedText}
Se dina bokningar: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

interface AccountDeletionConfirmationData {
  firstName: string
}

export function accountDeletionConfirmationEmail(data: AccountDeletionConfirmationData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Ditt konto har raderats</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p>Vi bekräftar att ditt konto hos Equinet har raderats. All personlig data har tagits bort i enlighet med GDPR.</p>

    <h3>Vad har hänt?</h3>
    <ul style="color: #6b7280; padding-left: 20px;">
      <li>Din personliga information har anonymiserats</li>
      <li>Uppladdade filer har raderats</li>
      <li>Eventuella bokningar finns kvar i anonymiserad form</li>
    </ul>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      Om du har frågor kan du kontakta oss på support@equinet.se.
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Ditt konto har raderats

Hej ${data.firstName}!

Vi bekräftar att ditt konto hos Equinet har raderats. All personlig data har tagits bort i enlighet med GDPR.

Vad har hänt?
- Din personliga information har anonymiserats
- Uppladdade filer har raderats
- Eventuella bokningar finns kvar i anonymiserad form

Om du har frågor kan du kontakta oss på support@equinet.se.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}

// -----------------------------------------------------------
// Customer Invite
// -----------------------------------------------------------

interface CustomerInviteData {
  firstName: string
  providerBusinessName: string
  inviteUrl: string
}

export function customerInviteEmail(data: CustomerInviteData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Du har blivit inbjuden till Equinet</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p><strong>${e(data.providerBusinessName)}</strong> har bjudit in dig att skapa ett konto på Equinet. Med ett konto kan du boka tjänster, se din bokningshistorik och hantera dina hästar.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.inviteUrl)}" class="button" style="font-size: 16px;">
        Aktivera ditt konto
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Länken är giltig i 7 dagar. Om du inte känner igen avsändaren kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in följande länk i din webbläsare:<br>
      <a href="${e(data.inviteUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.inviteUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Du har blivit inbjuden till Equinet

Hej ${data.firstName}!

${data.providerBusinessName} har bjudit in dig att skapa ett konto på Equinet. Med ett konto kan du boka tjänster, se din bokningshistorik och hantera dina hästar.

Aktivera ditt konto genom att klicka på länken nedan:

${data.inviteUrl}

Länken är giltig i 7 dagar. Om du inte känner igen avsändaren kan du ignorera detta mail.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
