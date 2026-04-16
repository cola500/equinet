import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"
import { baseStyles, e } from "./base-styles"

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
