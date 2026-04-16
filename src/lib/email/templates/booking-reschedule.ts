import { baseStyles, e } from "./base-styles"

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
