import { baseStyles, e } from "./base-styles"

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
