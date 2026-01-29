/**
 * Email Templates - HTML templates for various email notifications
 */

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
    <p>Hej ${data.firstName}!</p>
    <p>Tack for att du registrerade dig pa Equinet. Klicka pa knappen nedan for att verifiera din e-postadress.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.verificationUrl}" class="button" style="font-size: 16px;">
        Verifiera e-post
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Lanken ar giltig i 24 timmar. Om du inte registrerade dig pa Equinet kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in folande lank i din webblasare:<br>
      <a href="${data.verificationUrl}" style="color: #16a34a; word-break: break-all;">${data.verificationUrl}</a>
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
    <p>Hej ${data.customerName}!</p>
    <p>Din bokning har mottagits och väntar på bekräftelse från leverantören.</p>

    <h3>Bokningsdetaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${data.serviceName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${data.businessName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${data.bookingDate}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${data.startTime} - ${data.endTime}</span>
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
    <p>Boknings-ID: ${data.bookingId}</p>
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
    <p>Hej ${data.customerName}!</p>
    <p><span class="success-badge">Betalning mottagen</span></p>
    <p>Tack för din betalning! Här är ditt kvitto.</p>

    <h3>Kvittouppgifter</h3>
    <div class="detail-row">
      <span class="label">Kvittonummer:</span>
      <span class="value">${data.invoiceNumber}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${data.serviceName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${data.businessName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum för tjänst:</span>
      <span class="value">${data.bookingDate}</span>
    </div>
    <div class="detail-row">
      <span class="label">Betaldatum:</span>
      <span class="value">${data.paidAt}</span>
    </div>
    <div class="detail-row" style="border-bottom: 2px solid #16a34a;">
      <span class="label" style="font-weight: 600;">Totalt betalt:</span>
      <span class="value" style="font-size: 18px; color: #16a34a;">${data.amount} ${data.currency}</span>
    </div>

    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings" class="button">
      Se dina bokningar
    </a>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
    <p>Boknings-ID: ${data.bookingId}</p>
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
  }

  const statusBgColors: Record<string, string> = {
    confirmed: "#dcfce7",
    cancelled: "#fee2e2",
    completed: "#dbeafe",
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
    <p>Hej ${data.customerName}!</p>
    <p>Din bokning har uppdaterats:</p>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background: ${bgColor}; color: ${color}; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: 600;">
        ${data.statusLabel}
      </span>
    </div>

    <h3>Bokningsdetaljer</h3>
    <div class="detail-row">
      <span class="label">Tjänst:</span>
      <span class="value">${data.serviceName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Leverantör:</span>
      <span class="value">${data.businessName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${data.bookingDate}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tid:</span>
      <span class="value">${data.startTime}</span>
    </div>

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

  const text = `
Bokningsuppdatering

Hej ${data.customerName}!

Din bokning har uppdaterats: ${data.statusLabel}

BOKNINGSDETALJER
----------------
Tjänst: ${data.serviceName}
Leverantör: ${data.businessName}
Datum: ${data.bookingDate}
Tid: ${data.startTime}

Se dina bokningar: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/customer/bookings

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
