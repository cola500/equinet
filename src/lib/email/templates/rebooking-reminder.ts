import { baseStyles, e } from "./base-styles"

interface RebookingReminderData {
  customerName: string
  serviceName: string
  providerName: string
  rebookUrl: string
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
