---
title: "UX-förbättringar för inbjudningssystemet"
description: "Fixa alla UX-fynd från review av stable invite-sidorna"
category: plan
status: draft
last_updated: 2026-03-09
sections:
  - Kontext
  - Prioritet 1 Kritiska
  - Prioritet 2 Viktiga förbättringar
  - Prioritet 3 Tillgänglighet
  - Prioritet 4 Trevligt att ha
  - Implementationsordning
  - Nyckelinsikt
  - Befintliga mönster
  - Verifiering
---

# UX-förbättringar för inbjudningssystemet

## Kontext

UX-review av fas 6 (inbjudningssystem) identifierade 12+ problem. Accept-flödet
saknar auth-check och differentierade felstater. Stallägarsidan saknar actions
och expiry-info.

**Schemainsikt:** Det finns ingen user-stable-koppling för hästägare i schemat.
`Stable.userId` pekar på stallägaren (en-till-en). `Horse.stableId` kopplar hästar
till stall (fas 5). Hästägaren identifieras indirekt via `Horse.ownerId + Horse.stableId`.
Alltså: accept-flödet behöver INTE skapa en ny relation -- det räcker att markera token
som used + verifiera email. Hästägaren kopplar sedan sina hästar via StableSelector.

## Prioritet 1: Kritiska (måste fixas)

### 1a. Accept kräver auth + email-verifiering

**Problem:** `POST /api/stables/invites/[token]/accept` är public utan auth.
Vem som helst med token-URL:en kan markera inbjudan som använd.

**Lösning:**
- Accept-endpoint kräver auth: `auth()` -> 401 om ej inloggad
- **OBS:** `auth()` kastar Response vid unauthenticated -- lägg till
  `if (error instanceof Response) return error` i catch-blocket (samma mönster
  som protected routes i `src/app/api/stable/invites/route.ts`)
- Verifiera email med **case-insensitive** jämförelse:
  `session.user.email.toLowerCase() === invite.email.toLowerCase()`
- Om email matchar: markera token som used (befintlig `markUsed`)
- Om email inte matchar: returnera 403 "Inbjudan tillhör en annan e-postadress.
  Logga in med rätt konto eller be stallägaren skicka en ny inbjudan."
- Ingen schemaändring behövs -- hästägaren kopplar hästar via StableSelector (fas 5)

**Filer:**
- `src/app/api/stables/invites/[token]/accept/route.ts` -- lägg till auth() + email-check
- `src/app/api/stables/invites/[token]/accept/route.test.ts` -- uppdatera ALLA tester (auth-mock) + nya (email-match, email-mismatch)

### 1b. Accept-sidan hanterar auth-state + callbackUrl-stöd

**Problem:** Oinloggad användare trycker "Acceptera" och får okänt fel.

**Lösning:**
- Hämta auth-status via `useAuth()` i accept-sidan
- Om ej inloggad: visa "Du behöver logga in för att acceptera inbjudan" med två
  jämstora knappar: "Logga in" + "Skapa konto"
- Länka till `/login?callbackUrl=/invite/stable/${token}` respektive
  `/register?callbackUrl=/invite/stable/${token}`
- Om inloggad: visa acceptera-knapp som idag

**BLOCKER:** Login-sidan (`src/app/(auth)/login/page.tsx`) hard-kodar
`router.push("/dashboard")` efter lyckad inloggning. Måste uppdateras:
- Läs `callbackUrl` från `searchParams`
- Validera att den börjar med `/` (förhindra open redirect)
- Använd `callbackUrl || "/dashboard"` som redirect-mål

**Filer:**
- `src/app/invite/stable/[token]/page.tsx` -- auth-state UI
- `src/app/(auth)/login/page.tsx` -- callbackUrl-stöd (ny funktionalitet)

### 1c. Differentierade felstater med maskinläsbara koder

**Problem:** Utgången, redan använd och "ej hittad" visar samma generiska felsida.

**Lösning:**
- Lägg till maskinläsbar `code` i API-felresponser: `{ error: "...", code: "TOKEN_EXPIRED" }`
  (strängmatchning mot svenska felmeddelanden är fragilt)
- Uppdatera BÅDA publika routes (GET + POST accept) att returnera `code`-fält
- Spara feltyp i state: `errorType: "expired" | "used" | "not_found" | "email_mismatch" | "generic"`
- Rendera kontextuell recovery:
  - **expired**: "Inbjudan har gått ut. Be stallägaren skicka en ny."
  - **used**: "Inbjudan har redan använts." + länk till `/customer/horses`
  - **not_found**: "Inbjudan hittades inte."
  - **email_mismatch**: "Inbjudan är skickad till en annan e-post. Logga in med rätt konto."

**Filer:**
- `src/app/api/stables/invites/[token]/route.ts` -- lägg till `code` i felresponser
- `src/app/api/stables/invites/[token]/accept/route.ts` -- lägg till `code` i felresponser
- `src/app/invite/stable/[token]/page.tsx` -- mappa `code` -> errorType -> kontextuell UI

### 1d. Bättre feedback vid sändning + kopiera-länk

**Problem:** "Inbjudan skickad" visas även om email failar (fire-and-forget).

**Lösning:**
- Ändra API-response: returnera `{ message, inviteUrl }` (relativ URL `/invite/stable/${token}`)
- Efter lyckad POST: visa toast "Inbjudan skapad" (inte "skickad")
- Visa kopiera-länk i ett expanderat fält under formuläret med "Kopiera länk"-knapp
- Klienten bygger full URL: `window.location.origin + inviteUrl`
  (återanvänd mönstret från `ShareProfileDialog.tsx`: `navigator.clipboard.writeText()` + toast)

**Filer:**
- `src/app/api/stable/invites/route.ts` -- returnera inviteUrl
- `src/app/stable/invites/page.tsx` -- kopiera-länk UI
- `src/app/api/stable/invites/route.test.ts` -- uppdatera assertion

### 1e. Evig spinner om ej stallägare

**Problem:** `isLoading` sätts aldrig till `false` om `fetchInvites()` inte körs.

**Lösning:**
- Lägg till guard efter authLoading: `if (!isStableOwner) return <redirect eller meddelande>`
- Eller: initiera `isLoading` baserat på om fetch ska köras

**Fil:** `src/app/stable/invites/page.tsx`

## Prioritet 2: Viktiga förbättringar

### 2a. Åtgärder på befintliga inbjudningar (skicka igen / återkalla)

**Problem:** Listan visar status men inga actions.

**Lösning:**
- "Skicka igen" på väntande: POST till befintlig create-endpoint med samma email
  (obs: `createInvite` anropar `invalidatePending` först -- gamla token ogiltigförklaras)
  - UI: gammal rad blir "Utgången/Ogiltigförklarad", ny rad dyker upp som "Väntande"
- "Återkalla" med bekräftelsedialog (`ResponsiveAlertDialog`): soft-delete via `invalidatePending`
- **Ny route-fil:** `src/app/api/stable/invites/[id]/route.ts` -- DELETE handler
  (kan INTE läggas i befintlig `route.ts` som saknar `[id]` i path)
- **Ny repo-metod:** `revoke(id: string, stableId: string): Promise<void>` i IStableInviteRepository
  (verifierar ownership via stableId i WHERE)
- Visa `DropdownMenu` med `MoreHorizontal`-trigger per invite-rad (befintligt mönster)

**Filer:**
- `src/app/stable/invites/page.tsx` -- action-meny per rad
- `src/app/api/stable/invites/[id]/route.ts` -- NY fil, DELETE handler
- `src/app/api/stable/invites/[id]/route.test.ts` -- NY fil, tester
- `src/infrastructure/persistence/stable-invite/IStableInviteRepository.ts` -- ny `revoke`
- `src/infrastructure/persistence/stable-invite/PrismaStableInviteRepository.ts` -- impl
- `src/infrastructure/persistence/stable-invite/MockStableInviteRepository.ts` -- impl

### 2b. Visa utgångsdatum

**Problem:** Varken stallägare eller inbjuden ser när inbjudan går ut.

**Lösning:**
- **Stallägare-listan:** Visa "Går ut {datum}" på väntande, "Gick ut {datum}" på utgångna
- **Accept-sidan:** API returnerar redan `expiresAt` via `validateToken` -- lägg till
  i GET-response + visa "Inbjudan går ut {datum}" under stallinfo
- `expiresAt` finns redan i `StableInviteListItem`

**Filer:**
- `src/app/stable/invites/page.tsx` -- InviteStatus-komponenten
- `src/app/api/stables/invites/[token]/route.ts` -- lägg till expiresAt i response
- `src/app/invite/stable/[token]/page.tsx` -- visa expiry

### 2c. Inline email-validering

**Problem:** Enbart browser-native validation, ingen inline feedback.

**Lösning:**
- `onBlur`-validering med enkel regex + inline felmeddelande under inputen
- `<p role="alert" aria-live="polite">` vid valideringsfel

**Fil:** `src/app/stable/invites/page.tsx`

### 2d. Mobil layout-fix

**Problem:** Input + knapp på samma rad kläms ihop på 320px.

**Lösning:**
- Ändra `flex gap-2` till `flex flex-col sm:flex-row gap-2`
- Knappen tar full bredd på mobil

**Fil:** `src/app/stable/invites/page.tsx`

### 2e. Trunkering av långa emailadresser

**Problem:** Lång email kolliderar med statusbadge.

**Lösning:**
- Lägg till `truncate min-w-0` på email-span, `flex-shrink-0` på badge

**Fil:** `src/app/stable/invites/page.tsx`

## Prioritet 3: Tillgänglighet

### 3a. Spinner aria-label

Lägg till `aria-label="Laddar..." role="status"` på spinner-divs på båda sidorna.

### 3b. Kontrastfix på omgivande text vid "Registrera dig"-länk

Ändra `text-gray-400` till `text-gray-600` på "Har du inget konto?"-texten
för att nå WCAG AA 4.5:1. Länken själv (`text-blue-600`) har redan OK kontrast.

### 3c. Aria-hidden på dekorativa tecken

Wrappa `&#10003;` och `&#10007;` i `<span aria-hidden="true">`.

### 3d. Aria-describedby på email-input vid valideringsfel

Koppla felmeddelandets `id` till inputens `aria-describedby`.

## Prioritet 4: Trevligt att ha

### 4a. Sortera inbjudningar

Väntande först -> Accepterad -> Utgången. Sortera client-side.

### 4b. Bättre tom-state

Byt "Inga inbjudningar skickade ännu." till text med vägledning:
"Bjud in hästägare som har sina hästar i ditt stall för att koppla dem."

### 4c. Vänligare success-state

Byt raw `&#10003;` mot `CheckCircle` från lucide-react med grön färg.
Ändra copy: "Du är nu med i {stallnamn}!" före next-steps-text.

### 4d. Filter "Visa bara aktiva"

Toggle-knapp som döljer utgångna inbjudningar. Enkel client-side filter.

## Implementationsordning

| Fas | Scope | Filer |
|-----|-------|-------|
| **Fas 1** | 1a + 1b (auth på accept + callbackUrl + auth-UI) | ~4 filer + tester |
| **Fas 2** | 1c + 1d + 1e (felkoder, feedback, spinner) | ~5 filer |
| **Fas 3** | 2a + 2b (actions med ny route + repo-metod + expiry) | ~8 filer + tester |
| **Fas 4** | 2c-e + 3a-d + 4a-d (polish + a11y + nice-to-have) | ~3 filer |

## Nyckelinsikt: Ingen schemaändring behövs

Schemat har redan rätt struktur:
- `Stable.userId` -> stallägaren (en-till-en via User)
- `Horse.stableId` -> hästar kopplas till stall (fas 5, StableSelector)
- Hästägare identifieras implicit via `Horse.ownerId` + `Horse.stableId`

Accept-flödet behöver bara: (1) verifiera auth, (2) matcha email, (3) markera used.
Hästägaren gör sedan själv kopplingen via StableSelector på häst-profilsidan.

## Befintliga mönster att återanvända

| Mönster | Fil | Användning |
|---------|-----|------------|
| Kopiera-länk | `src/app/customer/horses/[id]/ShareProfileDialog.tsx` | `navigator.clipboard.writeText()` + toast |
| Bekräftelsedialog | `src/components/ui/responsive-alert-dialog.tsx` | Mobil drawer / desktop dialog |
| Action-meny | `src/components/ui/dropdown-menu.tsx` | Radix DropdownMenu + MoreHorizontal |
| Auth-hook | `src/hooks/useAuth.ts` | `isAuthenticated`, `isStableOwner`, email |
| Dialog state | `src/hooks/useDialogState.ts` | `open`/`close`/`toggle` |

## Verifiering (efter VARJE fas)

**Mellan varje fas:**
1. `npm run test:run -- --reporter=dot <berörda testfiler> 2>&1 | tail -30` -- nya/ändrade tester gröna
2. `npm run typecheck` -- 0 errors
3. Max 3 fix-försök per fas. Om fortfarande failing, STOP.

**Slutverifiering (efter alla faser):**
1. `npm run test:run` -- ALLA tester gröna (ingen regression)
2. `npm run typecheck` -- 0 errors
3. `npm run lint` -- 0 errors
4. `npm run check:swedish` -- inga nya varningar
5. Security spot-check på nya/ändrade API routes
6. Manuell test: öppna invite-länk oinloggad -> se auth-prompt -> logga in -> acceptera
7. Manuell test: kopiera-länk på stallägarsidan fungerar
8. Skärmläsartest: spinner, badges, felstater annonseras korrekt
