---
title: "Hackathon: Smart-replies i leverantör-tråd"
description: "2h hackathon -- quick-reply-chips ovanför skriv-fältet i ThreadView"
category: idea
status: active
last_updated: 2026-04-19
tags: [hackathon, messaging, ux]
sections:
  - Mål
  - Scope
  - Var i koden
  - Regler
---

# Hackathon: Smart-replies i leverantör-tråd

**Datum:** 2026-04-19
**Tidsram:** 2h hard-stop
**Tema:** Kommunikation mellan kund och leverantör

---

## Mål

Leverantör öppnar en messaging-tråd → ser 3-5 klickbara quick-reply-chips ovanför skriv-fältet. Klick → meddelandet skickas direkt via befintlig API, chips försvinner (eller uppdateras).

**Varför:** Leverantörer har ofta samma svar. Mallar + variabel-expansion = stor upplevd intelligens, liten effort.

---

## Scope

**MÅSTE:**
- 3-5 chips renderas i ThreadView (`/provider/messages/[bookingId]`)
- Variabel-expansion från Booking-data (kundnamn, datum, tjänst)
- Variabel-expansion från Provider-profil (adress, telefon) — hämta från existerande endpoint
- Klick → POST till befintlig `/api/bookings/[id]/messages`
- Optimistic update efteråt (redan implementerat i S39-3, bör "bara fungera")

**NICE:**
- Haptic på klick (iOS bara)
- Aria-labels för skärmläsare
- Chips-animation (fade-in vid mount)

**SKIPPA:**
- Customer-side (MessagingDialog)
- Admin-konfiguration av mallar
- AI-genererade förslag
- Persona-anpassning

---

## Var i koden

- **Tråd-vy:** `src/app/provider/messages/[bookingId]/page.tsx` — lägg chips ovanför `<Textarea>`
- **API:** Återanvänd befintlig `POST /api/bookings/[id]/messages`
- **Variabel-data:** `MessagesResponse` har redan `customerName`, `serviceName`, `bookingDate` (från S37-2-fix)
- **Provider-profil:** `/api/provider/profile` — grep för vilka fält som returneras
- **Optional komponent:** `src/components/provider/messages/SmartReplyChips.tsx` om det blir >30 rader

---

## Förslag på mallar (5 st)

| # | Mall | Variabler |
|---|------|-----------|
| 1 | "Bekräftat, vi ses {datum} kl {tid}!" | booking.date + time |
| 2 | "Tack för ditt meddelande. Jag återkommer inom en timme." | — |
| 3 | "Ring mig på {telefon} om något är akut." | provider.phone |
| 4 | "Min adress: {adress}" | provider.address |
| 5 | "Kan vi flytta till en annan tid? Vilken passar dig?" | — |

Gå med ~5. Dev kan lägga till/ta bort baserat på vad som känns naturligt.

---

## Regler (hackathon-läge)

- **Ingen plan-fil.** Börja bygga direkt.
- **Ingen TDD.** Skriv test bara om det är kritiskt (t.ex. variabel-expansion-funktion).
- **Ingen formell done-fil.** Kort commit-meddelande räcker.
- **Commit direkt till main** — skippa PR för snabbhet.
- **Code-reviewer skippas.** Tech lead granskar post-hackathon som bakgrundsagent om något flaggas.
- **`npm run check:all` FÖRE commit** — det enda gate:t vi behåller.

**Tech lead-tillgänglig:** Om du fastnar >10 min på samma sak — skriv kort i commit-meddelande eller meddela Johan. Jag svarar under 2 min.

**Halvvägs-check (efter 1h):** Ärligt själv-reflektera — är MÅSTE-sektionen halvvägs klar? Om nej, droppa en mall eller ta bort en nice-to-have.

**Hard-stop vid 2h:** Stoppa även om något är 80%. Bättre demobar fragment än polerad halv-lösning. Vi reflekterar muntligt efteråt.

---

## Efter hackathon

**Output:** fungerande prototyp + kort reflektion (2-3 meningar i commit eller chat till Johan):
- Vad blev klart?
- Vad var svårast?
- Vad skulle du göra annorlunda om mer tid?

**Beslut efter demo:**
- Polera + merga som riktig feature?
- Slänga och ta lärdomar?
- Bygga om annorlunda?
