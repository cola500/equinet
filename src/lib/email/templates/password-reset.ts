import { baseStyles, e } from "./base-styles"

interface PasswordResetData {
  firstName: string
  resetUrl: string
}

export function passwordResetEmail(data: PasswordResetData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Återställ ditt lösenord</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p>Vi har fått en begäran om att återställa lösenordet för ditt konto på Equinet.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.resetUrl)}" class="button" style="font-size: 16px;">
        Återställ lösenord
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Länken är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in följande länk i din webbläsare:<br>
      <a href="${e(data.resetUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.resetUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Återställ ditt lösenord

Hej ${data.firstName}!

Vi har fått en begäran om att återställa lösenordet för ditt konto på Equinet.

Klicka på länken nedan för att välja ett nytt lösenord:

${data.resetUrl}

Länken är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta mail.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
