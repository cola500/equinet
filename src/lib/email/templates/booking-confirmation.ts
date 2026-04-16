import { baseStyles, e } from "./base-styles"

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
