---
title: "GDPR -- Register över personuppgiftsbiträden"
description: "Alla tredjepartstjänster som behandlar personuppgifter för Equinets räkning, med ändamål, delad data och DPA-status"
category: security
status: active
last_updated: 2026-08-09
tags: [gdpr, security, privacy, subprocessors, dpa, dataskydd]
depends_on:
  - .env.example
  - package.json
related:
  - docs/security/gdpr-records-of-processing.md
  - docs/security/gdpr-gap-register.md
sections:
  - Syfte
  - Register
  - Hur registret hålls uppdaterat
  - Källor och metod
  - Ändringslogg
---

# GDPR -- Register över personuppgiftsbiträden

## Syfte

Enligt GDPR Art. 28 måste varje personuppgiftsbiträde (subprocessor) som behandlar
personuppgifter för Equinets räkning ha ett skriftligt avtal (Data Processing
Agreement, DPA) på plats. Detta register listar alla tredjepartstjänster som
identifierats i kodbasen och vilken data som delas med dem.

**Viktigt om DPA-status:** Detta dokument är en teknisk kartläggning av VILKA
tjänster som används och VILKEN data som flödar till dem -- inte en bekräftelse
på att avtal faktiskt är granskade eller accepterade. De flesta leverantörer
nedan erbjuder ett standardiserat DPA/"Data Processing Addendum" som ingår i
deras användarvillkor (ofta accepteras automatiskt vid kontoregistrering), men
ingen bekräftelse på detta har hittats i kodbasen -- det är inte heller möjligt
att verifiera från kod. **DPA-status per leverantör är en affärsuppgift som
kräver manuell uppföljning, se [gap-registret](gdpr-gap-register.md).**

## Register

| Tjänst | Ändamål | Personuppgifter som delas | Lagringsregion | DPA-status |
|--------|---------|----------------------------|-----------------|------------|
| **Supabase** | Autentisering, databas (Postgres), filstorage | I princip all data i registret ovan (Supabase hostar hela databasen) | Prod: Zürich. Staging: Frankfurt (EU/EES, enligt CLAUDE.md) | Ej verifierat i repo -- kontrollera att Supabase DPA accepterats i organisationens inställningar |
| **Stripe** | Betalningshantering (opt-in, `PAYMENT_PROVIDER="mock"` som default) | Namn, e-post, betalningsreferenser (inga kortnummer lagras lokalt) | Ej verifierat -- Stripe erbjuder EU-databehandling som tillval | Ej verifierat i repo |
| **Sentry** | Felövervakning (error tracking) | Kan innehålla PII i stack traces/breadcrumbs/context -- `beforeSend` scrubbar idag bara `cookie`/`authorization`-headers, se gap-registret | Ej verifierat (beror på vald Sentry-region) | Ej verifierat i repo |
| **Upstash Redis** | Rate limiting | IP-adresser | Ej verifierat | Ej verifierat i repo |
| **Resend** | Transaktionsmail (bokningsbekräftelser, kvitton, kontoraderingsbekräftelse, retention-varningar) | Namn, e-postadress, bokningsinnehåll i mailtext | Ej verifierat | Ej verifierat i repo |
| **Vercel** | Hosting, `@vercel/analytics/next` | Analytics beskrivs som cookielös i Vercels standardimplementation, men ingår inte i cookie-consent-flödet (se gap-registret). Hosting-lagret ser all trafik. | Fluid Compute-regioner konfigurerade mot `fra1` (Frankfurt) enligt CLAUDE.md | Ej verifierat i repo |
| **Fortnox** | Bokföringsintegration (OAuth, opt-in per leverantör) | Fakturadata, ev. kundnamn/adress som skickas till bokföring | Sverige (svensk leverantör) | Ej verifierat i repo |
| **Anthropic API** | Röstloggning/AI-tolkning av leverantörers diktat | Diktatinnehåll kan innehålla kundnamn, hästnamn, adresser i fri text | Ej verifierat -- redan flaggat som integritets-/GDPR-relevant i `docs/feature-flags/portfolio-audit.md:104` | Ej verifierat i repo |
| **Apple (APNs)** | Push-notiser till iOS-appen | Enhetstoken (`DeviceToken`) **och innehåll**: `MessageNotifier.ts` skickar avsändarnamn och ett utdrag (80 tecken) av meddelandetext i push-payloaden för nya meddelanden (`PushDeliveryService.sendAPNs`) -- se gap-registret | Apple-infrastruktur (global) | Ej verifierat i repo -- Apple Developer-avtalet täcker normalt APNs som en del av standardvillkoren |

**Ej en subprocessor (klargörande):** Ingen SMS-tjänst (t.ex. Twilio) hittades i
kodbasen -- om en sådan läggs till i framtiden ska den läggas till i detta register
innan den tas i drift.

## Hur registret hålls uppdaterat

Lägg till en rad i registret **innan** en ny extern tjänst som hanterar
personuppgifter tas i produktionsbruk (nytt SDK, ny env-variabel för en
tredjepartsnyckel, ny webhook-mottagare). Detta är i linje med Art. 25
(inbyggt dataskydd) -- bedömningen ska göras i samband med implementation,
inte efterhand.

## Källor och metod

Identifierat genom grep i `package.json`, `.env.example` och `src/lib/` efter
kända integrationsmönster (API-nycklar, SDK-importer, webhook-routes). Ingen
extern leverantörsdokumentation (t.ex. respektive bolags DPA-sida) har lästs
som en del av detta arbete -- DPA-status är därför konsekvent markerad som
"ej verifierat i repo" snarare än gissad.

## Ändringslogg

| Datum | Ändring |
|-------|---------|
| 2026-08-09 | Första versionen. Del av GDPR-dokumentationspaketet (se `docs/agent-operations/`). |
