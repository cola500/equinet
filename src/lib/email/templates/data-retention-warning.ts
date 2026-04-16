import { baseStyles } from "./base-styles"

export function dataRetentionWarningEmail(): { html: string; text: string } {
  const baseUrl = process.env.NEXTAUTH_URL || "https://equinet.vercel.app"
  const loginUrl = `${baseUrl}/login`
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Ditt konto kommer att raderas</h1>
  </div>
  <div class="content">
    <p>Hej!</p>
    <p>Vi har upptäckt att du inte har loggat in på Equinet på över 2 år. Enligt vår datalagringspolicy och GDPR kommer ditt konto att raderas inom <strong>30 dagar</strong> om du inte loggar in.</p>

    <h3>Vad händer om kontot raderas?</h3>
    <ul style="color: #6b7280; padding-left: 20px;">
      <li>Din personliga information anonymiseras</li>
      <li>Uppladdade filer raderas</li>
      <li>Bokningshistorik bevaras i anonymiserad form</li>
    </ul>

    <h3>Vill du behålla ditt konto?</h3>
    <p>Logga in på <a href="${loginUrl}" style="color: #16a34a;">Equinet</a> innan tidsfristen för att behålla ditt konto.</p>

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
Ditt konto kommer att raderas

Hej!

Vi har upptäckt att du inte har loggat in på Equinet på över 2 år. Enligt vår datalagringspolicy och GDPR kommer ditt konto att raderas inom 30 dagar om du inte loggar in.

Vad händer om kontot raderas?
- Din personliga information anonymiseras
- Uppladdade filer raderas
- Bokningshistorik bevaras i anonymiserad form

Vill du behålla ditt konto?
Logga in på ${loginUrl} innan tidsfristen för att behålla ditt konto.

Om du har frågor kan du kontakta oss på support@equinet.se.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
