import { baseStyles, e } from "./base-styles"

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

    <a href="${process.env.APP_URL || 'http://localhost:3000'}/customer/bookings" class="button">
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
Se dina bokningar: ${process.env.APP_URL || 'http://localhost:3000'}/customer/bookings

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
