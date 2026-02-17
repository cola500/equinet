import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token"

/**
 * Unsubscribe from booking reminders via email link.
 *
 * Uses HMAC-SHA256 token for stateless verification.
 * No login required -- the token proves the user received the email.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  const token = searchParams.get("token")

  if (!userId || !token) {
    return new NextResponse("Ogiltig länk. Kontrollera att du kopierade hela länken.", {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  if (!verifyUnsubscribeToken(userId, token)) {
    return new NextResponse("Ogiltig eller utgången länk.", {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailRemindersEnabled: false },
  })

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Avregistrerad - Equinet</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 80px auto; padding: 20px; text-align: center; color: #333; }
    .checkmark { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #6b7280; line-height: 1.6; }
    a { color: #16a34a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="checkmark">&#10003;</div>
  <h1>Du har avregistrerad dig</h1>
  <p>Du kommer inte längre att få bokningspåminnelser via e-post från Equinet.</p>
  <p style="margin-top: 24px;"><a href="/">Tillbaka till Equinet</a></p>
</body>
</html>
`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
