import { baseStyles, e } from "./base-styles"

interface StableInviteData {
  stableName: string
  inviteUrl: string
}

export function stableInviteEmail(data: StableInviteData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Du har blivit inbjuden till ${e(data.stableName)}</h1>
  </div>
  <div class="content">
    <p>Hej!</p>
    <p><strong>${e(data.stableName)}</strong> har bjudit in dig till sitt stall på Equinet. Med ett konto kan du koppla dina hästar till stallet, boka tjänster och hantera din hästs hälsohistorik.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${e(data.inviteUrl)}" class="button" style="font-size: 16px;">
        Visa inbjudan
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Länken är giltig i 7 dagar. Om du inte känner igen avsändaren kan du ignorera detta mail.
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
      Om knappen inte fungerar, kopiera och klistra in följande länk i din webbläsare:<br>
      <a href="${e(data.inviteUrl)}" style="color: #16a34a; word-break: break-all;">${e(data.inviteUrl)}</a>
    </p>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
  </div>
</body>
</html>
`

  const text = `
Du har blivit inbjuden till ${data.stableName}

Hej!

${data.stableName} har bjudit in dig till sitt stall på Equinet. Med ett konto kan du koppla dina hästar till stallet, boka tjänster och hantera din hästs hälsohistorik.

Visa inbjudan genom att klicka på länken nedan:

${data.inviteUrl}

Länken är giltig i 7 dagar. Om du inte känner igen avsändaren kan du ignorera detta mail.

--
Equinet - Din plattform för hästtjänster
`

  return { html, text }
}
