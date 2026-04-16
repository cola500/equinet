import { baseStyles, e } from "./base-styles"

interface EmailVerificationData {
  firstName: string
  verificationUrl: string
}

export function emailVerificationEmail(data: EmailVerificationData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Verifiera din e-post</h1>
  </div>
  <div class="content">
    <p>Hej ${e(data.firstName)}!</p>
    <p>Tack for att du registrerade dig pa Equinet. Klicka pa knappen nedan for att verifiera din e-postadress.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.verificationUrl)}" class="button" style="font-size: 16px;">
        Verifiera e-post
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Lanken ar giltig i 24 timmar. Om du inte registrerade dig pa Equinet kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in folande lank i din webblasare:<br>
      <a href="${e(data.verificationUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.verificationUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform for hasttjanster</p>
  </div>
</body>
</html>
`

  const text = `
Verifiera din e-post

Hej ${data.firstName}!

Tack for att du registrerade dig pa Equinet. Klicka pa lanken nedan for att verifiera din e-postadress:

${data.verificationUrl}

Lanken ar giltig i 24 timmar. Om du inte registrerade dig pa Equinet kan du ignorera detta mail.

--
Equinet - Din plattform for hasttjanster
`

  return { html, text }
}
