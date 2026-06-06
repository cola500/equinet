---
title: "Säker Staging Demo Seed"
description: "Runbook för att säkert återställa demo-provider-data (Erik Järnfot) på staging via helper-scriptet — med project-ref-guard, dry-run och verifiering."
category: operations
status: active
last_updated: 2026-06-06
sections:
  - Syfte
  - Säkerhetsmodell
  - Normal användning
  - Verifiering efter seed
  - Felsökning
  - Beslutslogg
  - Se även
tags:
  - staging
  - demo
  - seed
  - safety
  - supabase
depends_on:
  - docs/operations/demo-setup.md
  - docs/operations/staging-environment-setup.md
related:
  - docs/operations/demo-setup.md
---

# Säker Staging Demo Seed

Runbook för att återställa leverantördemons data (Erik Järnfot) på **staging** utan att
riskera att råka skriva mot **produktion**. All seedning går via ett helper-script som
validerar målet innan en enda rad skrivs.

> **TL;DR:** `npm run db:seed:staging-demo:safe -- --dry-run` för att torrköra, sedan
> `npm run db:seed:staging-demo:safe` för skarp körning. Du klistrar in staging-databasens
> connection string i en tyst prompt (ekar aldrig). Verifiera efteråt enligt [checklistan](#verifiering-efter-seed).

---

## Syfte

### Varför helper-scriptet finns

Demo-provider-seeden (`scripts/seed-demo-provider.ts`) skapar Erik Järnfot via Supabase
Admin API **och** skriver kunder/hästar/bokningar via Prisma. Den läser `DATABASE_URL`
från miljön. Tre problem gör en rå körning riskabel:

1. **Ingen inbyggd prod-guard (tidigare).** `prisma/seed-guard.ts` (`assertSeedSafe`) var
   bara inkopplad i `prisma/seed.ts` — **inte** i demo-provider-seeden. Pekade `DATABASE_URL`
   fel kunde demon seedas rakt in i prod-DB:n (dokumenterad risk "D" i
   [staging-environment-setup.md](./staging-environment-setup.md)).
2. **`DATABASE_URL` går inte att hämta automatiskt.** Den är markerad *sensitive* i Vercel
   och returneras **tom** av `vercel env pull` (write-only). Den måste matas in manuellt.
3. **Den dokumenterade metoden var osäker.** Tidigare runbook använde `export DATABASE_URL=…`
   i skalet, vilket läcker connection-stringen till shell-history.

Helper-scriptet (`scripts/seed-staging-demo.sh`) löser alla tre: tyst prompt (ingen
history-läcka), project-ref-validering före körning, och ingen connection string skriven
till `.env`-filer eller disk.

### Varför "vanlig" demo-seed är riskabel

`npm run db:seed:demo-provider:reset` kör seeden mot vad `DATABASE_URL` än pekar på, utan
att fråga. Lokalt pekar den på localhost (ofarligt), men om du exporterat eller klistrat in
fel URL kan den träffa prod. Använd därför **alltid** helper-scriptet för staging.

---

## Säkerhetsmodell

### Project-refs

| Miljö | Supabase project ref | Region |
|-------|----------------------|--------|
| **Staging** (tillåten) | `zzdamokfeenencuggjjp` | Frankfurt (eu-central-1) |
| **Produktion** (vägras alltid) | `xybyzflfxnqqyxnvjklv` | Zürich (eu-central-2) |
| **Lokal** | — (`127.0.0.1`) | localhost |

Project-ref extraheras ur connection-stringen (`extractSupabaseProjectRef` i
`prisma/seed-guard.ts`) från tre format: pooler (`postgres.<ref>@…pooler…`), direct
(`@db.<ref>.supabase.co`) och API-URL (`https://<ref>.supabase.co`).

### Guard-beteende (`assertStagingSeedSafe`)

Körs **först i `main()`**, före varje DB-skrivning och Supabase Admin-anrop:

| Mål | Default (`SEED_TARGET` osatt) | `SEED_TARGET=staging` (helpern) |
|-----|-------------------------------|----------------------------------|
| localhost | ✅ tillåts (lokal dev) | ❌ vägras |
| staging-ref `zzdamokfeenencuggjjp` | ✅ tillåts | ✅ tillåts |
| prod-ref `xybyzflfxnqqyxnvjklv` | ❌ vägras (PRODUCTION) | ❌ vägras |
| okänd hostad Supabase | ❌ vägras | ❌ vägras |

Defense-in-depth: helper-scriptet gör **dessutom** en egen bash-nivå-kontroll (vägrar prod,
localhost och icke-staging) **innan** det ens hämtar övrig env eller anropar Node.

### `--dry-run` och `--check-only`

- **`scripts/seed-staging-demo.sh --dry-run`**: kör hela kedjan (prompt → bash-guard →
  `vercel env pull` → TS-guard) men anropar seeden med `--check-only` → **ingen DB-skrivning**.
- **`scripts/seed-demo-provider.ts --check-only`**: kör guarden och avslutar med
  `"Guard OK"` innan första skrivningen. Används av `--dry-run` och kan köras fristående.

---

## Normal användning

Förutsättningar: Vercel CLI inloggad och projektet länkat (`.vercel/project.json` finns).
Du behöver staging-databasens **direct**-URL (port `5432`, host `db.zzdamokfeenencuggjjp.supabase.co`).

### 1. Torrkör (rekommenderat först)

```bash
npm run db:seed:staging-demo:safe -- --dry-run
# eller: bash scripts/seed-staging-demo.sh --dry-run
```

Klistra in staging-`DATABASE_URL` i prompten (ekar inte). Förväntat:

```
✓ URL pekar på staging (zzdamokfeenencuggjjp), host: db.zzdamokfeenencuggjjp.supabase.co
✓ Hämtade Supabase-env för staging (service-role-nyckel: 219 tecken, aldrig utskriven)
Guard OK — target verifierat. (--check-only: ingen seed körd.)
DRY-RUN klar: validering OK, ingen seed körd, ingen DB-skrivning.
```

### 2. Skarp seed

```bash
npm run db:seed:staging-demo:safe
# eller: bash scripts/seed-staging-demo.sh
```

Samma prompt, sedan en `(y/N)`-bekräftelse innan databasen rörs. `--reset` raderar och
återskapar demo-kunder/hästar/bokningar/recensioner/meddelanden. **Erik-kontot och hans
tjänster berörs inte.** Connection-stringen skrivs aldrig till `.env`-filer; temp-filen från
`vercel env pull` städas via `trap`.

> **Interaktiv prompt:** `read -rsp` kräver en riktig terminal. Kör i ett eget terminalfönster
> (eller med `!`-prefix i Claude Code om klienten ger TTY). Klistra **aldrig** in URL:en som
> vanlig text — bara i den tysta prompten.

### 3. Inkludera en inloggningsbar demokund (för kundhemmet `/hem`)

Default-seeden skapar kunderna som **ghost** (ingen login). För att kunna demonstrera
**hästägarens hem** (`/hem`) krävs en inloggningsbar kund. Opt-in-flaggan `--customer-login`
gör **en** kund (Lisa Andersson) inloggningsbar via Supabase Auth (samma säkra mönster som
Erik). Default-beteendet är oförändrat — flaggan måste anges explicit.

```bash
npm run db:seed:staging-demo:customer:safe
# eller: bash scripts/seed-staging-demo.sh --customer-login
```

| Fält | Värde |
|------|-------|
| E-post | `lisa.andersson@gmail.com` |
| Lösenord | `DemoOwner123!` |
| Roll | kund (hästägare) |
| Data | 2 hästar (Molly, Storm), kommande + genomförda bokningar, försenat besök, vårdhistorik |

> Detta är en **demo-uppgift** för staging (ej hemlighet), i nivå med Eriks `DemoProvider123!`.
> Det är **inte** ett nytt kund-demoläge — ingen DemoLoginButton/demo-nav. Provider-demon (Erik)
> påverkas inte. Prod vägras av guarden.

---

## Verifiering efter seed

Logga in på staging som Erik (uppgifter i [demo-setup.md](./demo-setup.md)) och kontrollera:

| Vy | Förväntat |
|----|-----------|
| **Dashboard** | "Kommande bokningar" > 0 (t.ex. 8), "Nya förfrågningar" > 0, intäktsgraf visar data |
| **Kalender** | Framtida bokningsblock syns. Banner "X bokningar väntar". Se gotcha nedan. |
| **Bokningar** | Mix av status: Väntar / Bekräftade / Genomförda / Avbokade |
| **Meddelanden** | Realistiska konversationer, **inga** test-strängar (t.ex. "3B.2 smoke-test") |
| **Kundhem `/hem`** (om `--customer-login`) | Logga in som Lisa → landar på `/hem`; statusrad (lugnt/larm), hästkort, aktiv Hem-flik |

> **Kalender-gotcha:** Veckovyn renderar i nuläget bara en dagkolumn (känd UI-bugg, ej
> seed-relaterad). Verifiera framtida block i **dag-** eller **månadsvy** tills den buggen är
> åtgärdad. Bokningarna börjar +2 dagar fram, så *dagens* kolumn kan vara tom.

---

## Felsökning

| Symptom | Trolig orsak | Åtgärd |
|---------|--------------|--------|
| **Inga kommande bokningar** på Dashboard/Kalender | Seeden kördes för länge sedan; de relativa `daysFromNow(2..14)`-bokningarna har blivit dåtid | Kör om med `--reset` (helpern gör alltid reset) |
| **Gammal seed-data uppdateras inte** vid omkörning | `upsert` med `update: {}` + skip-logik (`scripts/seed-demo-provider.ts`) hoppar över befintliga rader | Måste köras med `--reset` — vilket helpern gör |
| **Test-/smoke-sträng** ("3B.2 smoke-test") syns i Meddelanden | Manuellt inmatad data i staging-DB (finns ej i seed-koden) | `--reset` raderar demo-kunders konversationer och återskapar rena. Om strängen kommer från ett **icke**-demo-konto: radera den konversationen manuellt i DB |
| **Guard-fel: "is PRODUCTION"** | URL:en pekar på prod-ref `xybyzflfxnqqyxnvjklv` | Du har fel connection string. Hämta staging-direct-URL från Supabase Dashboard (projekt `zzdamokfeenencuggjjp`) |
| **Guard-fel: "not the allowed staging project"** | Okänd/fel hostad Supabase-ref | Samma som ovan — verifiera project-ref |
| **Guard-fel: "points to localhost but staging was required"** | Du körde helpern men gav en localhost-URL | Ange staging-URL, inte `127.0.0.1` |
| **"vercel env pull misslyckades"** | CLI ej inloggad eller projekt ej länkat | `vercel login` + `vercel link`, kontrollera `.vercel/project.json` |
| **`NEXT_PUBLIC_SUPABASE_URL`/service-role saknas** | Preview-env saknar variablerna | Verifiera i Vercel UI att Preview-raderna finns för branch `staging` |

> **Fel miljö generellt:** Kör aldrig `npm run db:seed:demo-provider:reset` direkt mot
> staging/prod utan guarden. Använd alltid helpern. Kör `npm run env:status` för att se vilken
> DB som är aktiv lokalt.

---

## Beslutslogg

- **2026-06-01:** Staging-demon visade 0 kommande bokningar — Dashboard och Kalender såg
  tomma ut. Rotorsak: seeden hade körts veckor tidigare, och dess relativa
  `daysFromNow(+2..+14)`-bokningar hade hunnit bli historiska.
- En **`--reset`** krävdes (en vanlig omkörning hoppar över befintliga rader pga idempotent
  `upsert`/skip-logik och uppdaterar därför inte datumen).
- En **guard** byggdes (`assertStagingSeedSafe` + `extractSupabaseProjectRef`) och kopplades
  in i `scripts/seed-demo-provider.ts`, eftersom demo-provider-seeden saknade prod-skydd
  (`assertSeedSafe` fanns men var bara inkopplad i `prisma/seed.ts`). Detta minskar risken att
  råka seeda prod.
- Ett **helper-script** (`scripts/seed-staging-demo.sh` + `npm run db:seed:staging-demo:safe`)
  ersatte den tidigare osäkra `export DATABASE_URL=…`-metoden: tyst prompt, project-ref-koll,
  ingen connection string på disk, `--dry-run`.
- `DATABASE_URL` bekräftades vara *sensitive* i Vercel (kom tillbaka tom från
  `vercel env pull`) → därför den manuella prompten istället för auto-hämtning.

---

## Se även

- [demo-setup.md](./demo-setup.md) — inloggningsuppgifter för Erik + vad demo-datan innehåller
- [staging-environment-setup.md](./staging-environment-setup.md) — staging-miljöns env-uppsättning,
  `DATABASE_URL`-delning och Vercel sensitive-vars-fällor
- Kod: `scripts/seed-staging-demo.sh`, `scripts/seed-demo-provider.ts`, `prisma/seed-guard.ts`
