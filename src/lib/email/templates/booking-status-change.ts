import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"
import { baseStyles, e } from "./base-styles"

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
Se dina bokningar: ${process.env.APP_URL || 'http://localhost:3000'}/customer/bookings

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
