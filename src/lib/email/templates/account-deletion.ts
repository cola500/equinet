import { baseStyles, e } from "./base-styles"

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
