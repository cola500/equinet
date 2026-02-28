# Vecka 5 Februari: Hardening (2026-02-26 -- 2026-02-28)

> Konsoliderad sammanfattning av 3 retrospectives: lint cleanup, pentest-hardening, och migrationsspårning.

## Sammanfattning

| Session | Datum | Ämne | Resultat |
|---------|-------|------|----------|
| 66 | 2026-02-26 | Lint Cleanup | 1187 → 0 varningar, 191 filer, 2641 tester gröna |
| 67 | 2026-02-27 | Pentest-hardening (ZAP) | 6/9 fynd fixade, SRI + CSP hardening, 15 filer, 2577 tester gröna |
| 71 | 2026-02-28 | Namnbaserad migrationsspårning | 12 filer, 2 nya scripts, 2783 tester gröna |

---

## Viktiga learnings

### Lint Cleanup (Session 66)
- **`as never` är universellt mönster** för testmockar: ersatte ~950 förekomster av `as any` utan att introduceera`any`. `never` är assignerbar till alla typer.
- **SessionUser-interface** skapad för NextAuth-assertions i API routes: `(session.user as SessionUser).providerId` istället för `as any`.
- **Parallella agenter fungerar** -- max 4 agenter å gången, max ~40 filer per agent. 3 stora batchar = context overflow; 4-5 små batchar = klara jobbet.
- **Typecheck efter varje fil förhindrar kaskadfel** -- agenter som ändrar typer (hooks, repositories) måste verifiera konsumenter (pages, services) för att undvika 30+ nya typecheck-errors.
- **`any` döljer latenta buggar** -- att ta bort `any` avslöjade returtypsfel, saknade null-guards, inkompatibla interfaces.

### Pentest-hardening (Session 67)
- **SRI är kraftfull alternativ till nonce för CSP** -- `experimental.sri: { algorithm: 'sha256' }` i `next.config.ts` genererar `integrity=` på alla `<script>`-taggar. Tillåter `script-src 'self'` utan `unsafe-inline` utan att offra statisk generering/CDN-caching.
- **9 ZAP-fynd: 6 fixade, 3 accepterade/falska positiver:**
  - **H1 (Rate limiting register)** -- begränsad `POST /api/auth/register` till 5 req/10min
  - **M1 (Security headers)** -- HSTS, COOP, CORP, COEP, Permissions-Policy tillagda
  - **M2 (CSP SRI)** -- `script-src 'self'` utan `unsafe-inline` via SRI
  - **M3 (Error sanitering)** -- verbose felmeddelanden borttagna från klientrespons
  - **M4 (CSRF Origin)** -- Origin-validering på POST-routes
  - **L4 (X-Powered-By)** -- header borttagen

- **`style-src 'unsafe-inline'` kvarstar** -- Tailwind CSS + 23 dynamiska `style={}` gör att vi inte kan ta bort detta nu. Accepterad risk, medium prioritet längre fram.
- **Pentest-rapport som baseline** -- ZAP-rapport ger objektiv säkerhetsstatus för framtida audits.

### Namnbaserad migrationsspårning (Session 71)
- **COUNT(*)-baserad jämförelse döljer drift** -- migrationer applicerade utanför Prisma (db push, apply_migration) syns inte i COUNT(*). Namnbaserad jämförelse med `comm` fångar ALLA avvikelser.
- **`scripts/_lib.sh` för DRY** -- delad hjälpfil med 6 funktioner (get_direct_url, is_localhost_url, require_docker, query_supabase, get_local_migration_names, get_remote_migration_names).
- **`comm` är perfekt för set-operationer** -- `comm -23` = pending, `comm -13` = drift, `comm -12` = synkade. Robust, inga externa beroenden.
- **Nya kommando: `npm run migrate:status`** -- fullständig namnbaserad jämförelse med pending/drift/misslyckade migrationer.

---

## Nyckelmetrik

| Mätning | Värde |
|---------|-------|
| **ESLint-varningar** | 1187 → 0 (100% eliminering, session 65-66) |
| **Lint-filer ändrade** | 191 (73 prod, 118 test) |
| **Pentest ZAP-fynd** | 9 totalt, 6 fixade |
| **Säkerhetsfiler ändrade** | 15 (config, API, infrastructure, lib) |
| **Migrationsskript** | 12 ändrade, 2 nya |
| **Totala tester (slut v5)** | 2783 (alla gröna, 0 regressioner) |
| **Typecheck-fel** | 0 |
| **Lint-varningar** | 0 |

---

## Arkitektura & Mönster

### Testtypning
```typescript
// Universell ersättning för `as any` i testmockar:
mockAuth.mockResolvedValue({ user: { id: "1" } } as never)
mockPrisma.booking.findMany.mockResolvedValue([{ id: "1" }] as never)
```

### API-säkerhet (NextAuth)
```typescript
import type { SessionUser } from "@/types/auth"
const providerId = (session.user as SessionUser).providerId
```

### CSP-hardening (SRI)
```typescript
// next.config.ts
experimental: {
  sri: { algorithm: 'sha256' }
}
// Resultat: script-src 'self' utan unsafe-inline, fullständigt statisk
```

### Bash-skript DRY
```bash
# scripts/migrate-check.sh
source "$(dirname "$0")/_lib.sh"
LOCAL_MIGRATIONS=$(get_local_migration_names)
REMOTE_MIGRATIONS=$(get_remote_migration_names)
```

---

## 5 Whys -- Key Problems Fixed

### Problem: 1187 ESLint-varningar blockerade releases
1. Varför? `any` introducerades för snabba typfixar utan att refaktorera
2. Varför? Type-strictness togs bort för att komma vidare
3. Varför? Projektets typning var inkomplett (ingen SessionUser interface, etc)
4. Varför? NextAuth-typning och SWR-generics var inte lösta
5. Varför? Projektet växte fort utan strukturerad typning

**Åtgärd:** SessionUser-interface + `as never`-mönster för mockar + parallella agenter
**Status:** KLAR (0 varningar)

### Problem: ZAP-pentest avslöjade CSP-problem
1. Varför? `unsafe-inline` tillåtades i `script-src` för enkla testlösningar
2. Varför? Nonce-baserad CSP kräver dynamisk rendering = prestanda-hit
3. Varför? SRI-stöd i Next.js var för nytt för att använda
4. Varför? Vi kände inte till SRI som alternativ
5. Varför? Experimentiella features testas inte tidigare i projektet

**Åtgärd:** Implementera SRI i next.config.ts, ta bort `unsafe-inline` från `script-src`
**Status:** KLAR (M2-fynd fixad)

### Problem: Migrationsstatusskripten gav felaktig feedback
1. Varför? COUNT(*)-baserad jämförelse räknade bara applicerade rader
2. Varför? Migrationer applicerade utanför Prisma (apply_migration) syns inte
3. Varför? Vi antog alla migrationer gick genom Prisma
4. Varför? Deploy-processen använder Prisma + MCP i olika steg
5. Varför? Ingen helhetsbild av migrationsstatus fanns

**Åtgärd:** Byta till namnbaserad jämförelse med `comm`, nytt script `migrate:status`
**Status:** KLAR (drift-problem nu synligt)

---

## Vad Kommer Härnäst

1. **NFR-05 (Automatiserad säkerhetsskanning)** -- ZAP-baseline i CI-pipeline
2. **Lösa `style-src 'unsafe-inline'`** -- dynamisk CSS utan inline styles (~medium prioritet)
3. **Bash-skript-tester** -- bats/shunit2 för migrationsskripten (low prioritet)
4. **Pentest Q2** -- återkörning av ZAP för att verifiera forbättringar

---

*Originalsdokument: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)*
