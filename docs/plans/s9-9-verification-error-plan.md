---
title: "S9-9: Fixa verifierings-felmeddelande"
description: "Overifierad email visar fel felmeddelande vid inloggning"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Analys
  - Losning
  - Filer
  - TDD-plan
  - Risker
---

# S9-9: Fixa verifierings-felmeddelande

## Analys

**Bugg:** Overifierad email ger "Ogiltig email eller lösenord" istallet for
"Din e-post ar inte verifierad" vid inloggning.

**Rotorsak:** NextAuth v5 beta.30 returnerar `result.error = "CredentialsSignin"`
oavsett vad authorize-funktionen kastar. Det faktiska felmeddelandet
("EMAIL_NOT_VERIFIED") nar aldrig klienten.

**Beviskedja:**
1. `AuthService.verifyCredentials()` -> `Result.fail({ type: 'EMAIL_NOT_VERIFIED', message: 'EMAIL_NOT_VERIFIED' })`
2. `auth.ts` authorize: `throw new Error(result.error.message)` -> kastar `Error("EMAIL_NOT_VERIFIED")`
3. NextAuth `signIn("credentials", { redirect: false })` -> returnerar `{ error: "CredentialsSignin" }`
4. `login/page.tsx` rad 62: `result.error === "EMAIL_NOT_VERIFIED"` -> ALDRIG true
5. Faller till rad 65: `setError("Ogiltig email eller losenord")`

**Redan korrekt:** `native-login/route.ts` anropar AuthService direkt och
returnerar strukturerade fel (typ + HTTP-status). Login-sidans UI for
EMAIL_NOT_VERIFIED (rad 123-132) ar redan implementerat -- det nar bara aldrig dit.

## Lösning

Skapa `/api/auth/web-login` route som anropar AuthService direkt (samma monster
som native-login) och returnerar strukturerade feltyper. Login-sidan byter fran
`signIn("credentials")` till denna route + manuell `signIn("credentials")` vid
success.

### API route: `/api/auth/web-login`

```
POST /api/auth/web-login
Body: { email, password }
200: { success: true }
401: { error: "Ogiltig email eller losenord", type: "INVALID_CREDENTIALS" }
403: { error: "Din e-post ar inte verifierad", type: "EMAIL_NOT_VERIFIED" }
403: { error: "Ditt konto har blockerats", type: "ACCOUNT_BLOCKED" }
429: { error: "For manga inloggningsforsoek", type: "RATE_LIMITED" }
```

### Login-sida: byt signIn-flode

1. POST till `/api/auth/web-login` med email + password
2. Om success (200): kor `signIn("credentials", { redirect: false })` for att
   skapa session (authorize kallar verifyCredentials igen -- idempotent)
3. Om fel: visa feltypen fran API-svaret

### Alternativ overvagd och avvisad

- **Anropa separat "check verification"-endpoint vid fel**: Exponerar information
  om konto-existens (timing attack). Avvisat.
- **Custom NextAuth error codes via CredentialsSignin.code**: NextAuth v5 beta
  exponerar inte `.code` till klienten vid `redirect: false`. Avvisat.

## Filer

| Fil | Ändring |
|-----|---------|
| `src/app/api/auth/web-login/route.ts` | NY -- web login med strukturerade fel |
| `src/app/api/auth/web-login/route.test.ts` | NY -- BDD tester |
| `src/app/(auth)/login/page.tsx` | Byt fran signIn() till web-login + signIn() |

## TDD-plan

### Fas 1: RED -- API route tester

- 401 vid ogiltiga credentials
- 403 med type=EMAIL_NOT_VERIFIED vid overifierad email
- 403 med type=ACCOUNT_BLOCKED vid blockerat konto
- 429 vid rate limiting
- 400 vid ogiltig JSON
- 200 vid korrekt inloggning

### Fas 2: GREEN -- Implementera API route

Kopiera monster fran native-login men for webben (session-baserad).

### Fas 3: Uppdatera login-sida

Byt signIn-flode till web-login + signIn.

### Fas 4: Verify

## Risker

- **Dubbel verifyCredentials**: Login anropar web-login (1) + signIn/authorize (2).
  Acceptabelt -- idempotent och snabb (bcrypt kor 2 ganger). Alternativ: skippa
  second check i authorize om web-login redan godkant, men det adderar komplexitet.
- **Rate limiting**: Bada anrop traffer samma rate limiter (per email). Second
  signIn-anropet bor inte utlosa rate limit efter lyckad web-login. Krav: resetta
  rate limit i web-login vid success (redan monster i authorize).
