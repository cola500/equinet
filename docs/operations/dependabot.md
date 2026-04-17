---
title: "Dependabot -- strategi och hantering"
description: "Hur Dependabot-uppdateringar hanteras: auto-merge, risker per paket, manuell granskning"
category: operations
status: active
last_updated: 2026-04-17
tags: [operations, dependencies, security, ci]
sections:
  - Översikt
  - Auto-merge-strategi
  - Vad som kan gå sönder
  - Manuell granskning per paket
  - Workflow-konfiguration
  - Felsökning
---

# Dependabot -- strategi och hantering

## Översikt

Dependabot (`.github/dependabot.yml`) skapar PRs för dependency-uppdateringar. Vi kör tre scheman:

| Kategori | Schema | Hantering |
|----------|--------|-----------|
| Patch (0.0.x) | Veckovis | Auto-merge vid grön CI |
| Minor (0.x.0) | Veckovis | Manuell granskning |
| Major (x.0.0) | Månadsvis | Manuell granskning + test |

## Auto-merge-strategi

**Patch-uppdateringar mergas automatiskt** när alla CI-jobb passerar:
- Unit tests + coverage (70% gate)
- E2E smoke tests
- TypeScript check
- Lint + svenska tecken
- Security audit (npm audit)
- Build check
- Migration from scratch

Branch protection kräver att alla dessa är gröna före merge.

### Varför bara patch, inte minor/major

Patch-uppdateringar (`0.0.x`) är per semver bara bugfixar och säkerhetspatchar -- inga API-ändringar. Risken är låg, volymen är hög, manuell granskning skulle kosta mer än det ger.

Minor- och major-uppdateringar kan innehålla nya funktioner eller breaking changes. Dessa måste granskas av en människa eller tech lead-session.

### Kan man verkligen lita på patch-uppdateringar?

**Nej, inte blint.** Men CI:t är starkt nog att fånga det mesta:
- 4045+ tester inkl. kritiska flöden
- TypeScript strict mode fångar API-ändringar
- E2E smoke verifierar att appen startar
- Build check verifierar att Next.js kan kompilera

**Det CI INTE fångar:**
- Prod-specifika bugs (Vercel runtime vs local)
- Subtila beteendeändringar som inte bryter tester
- Offline PWA-regressioner (begränsad E2E-täckning)
- Performance-regressioner

**Fallback:** Om något går sönder efter auto-merge -- `git revert <commit>` + push. Dependabot skapar en ny PR med samma uppdatering nästa vecka om problemet inte är löst i uppströms.

## Vad som kan gå sönder

Ordnade efter risk (högst först):

### 1. Prisma (`prisma`, `@prisma/client`)

**Risk: MEDEL.** Prisma har haft patch-regressioner (Query Engine-ändringar som ändrat beteende). `$transaction` är särskilt känslig.

**Manuell kontroll efter auto-merge:**
- Kör `npm run test:e2e:critical` lokalt
- Verifiera att bokningsflödet fungerar i dev

### 2. Service workers (`@serwist/next`, `serwist`)

**Risk: MEDEL.** Styr offline PWA-funktionaliteten som inte täcks av standard E2E.

**Manuell kontroll efter auto-merge:**
- Testa offline-läget i dev (DevTools -> Application -> Service Workers)
- Verifiera att mutation queue och sync fungerar

### 3. Next.js ekosystem (`next`, `eslint-config-next`, `next-auth`)

**Risk: LÅG-MEDEL.** Patch-uppdateringar oftast säkra, men Next.js har haft runtime-ändringar som påverkar Server Components.

**Manuell kontroll:** Build check fångar kompileringsfel, men verifiera att SSR fungerar.

### 4. Supabase (`@supabase/supabase-js`, `@supabase/ssr`)

**Risk: LÅG.** Oftast säkra på patch-nivå. JWT-hantering kan ändras.

**Manuell kontroll:** Logga in och ut efter merge, verifiera sessions.

### 5. Stripe (`stripe`)

**Risk: LÅG.** Stripe har stabilt patch-API. Webhook-hantering kan ändras.

**Manuell kontroll:** Verifiera webhook-signaturverifiering med test-event.

### 6. Typer (`@types/*`)

**Risk: MINIMAL.** Bara TypeScript-definitioner, inga runtime-ändringar. TypeScript check fångar allt.

**Manuell kontroll:** Ingen behövs.

### 7. Dev-dependencies (`eslint`, `vitest`, `playwright`)

**Risk: LÅG.** Påverkar bara utveckling/CI, inte prod.

**Manuell kontroll:** Kör `npm run check:all` lokalt.

## Manuell granskning per paket

Efter auto-merge av dessa paket, kör en manuell verifiering:

| Paket | Verifiering |
|-------|-------------|
| `prisma`, `@prisma/client` | `npm run test:e2e:critical` |
| `@serwist/next` | Offline-test i dev |
| `next` | Build + SSR-verifiering |
| `@supabase/*` | Login/logout-flöde |
| `stripe` | Webhook-test |

## Workflow-konfiguration

### `.github/workflows/dependabot-auto-merge.yml`

Auto-merge fungerar så här:

```yaml
- Fetch Dependabot metadata
- Om update-type == 'semver-patch':
    - Enable auto-merge (--squash --auto)
```

**VIKTIGT:** Vi approvar INTE PR:en. GitHub Actions kan inte approva sina egna PRs (säkerhetsinställning). Branch protection kräver bara att CI passerar -- det räcker.

### Tidigare fel: "GitHub Actions is not permitted to approve pull requests"

2026-04-12 försökte workflow:en `gh pr review --approve`. Det failade för att GitHub blockerar egen-approval. Fixad 2026-04-17 genom att ta bort approve-steget och bara köra `gh pr merge --auto`.

## Felsökning

### Dependabot-PR auto-mergas inte trots grön CI

1. Kolla workflow-logs: `gh api repos/cola500/equinet/actions/runs/<run-id>/jobs`
2. Är det "approve"-felet? Se fix ovan.
3. Har branch protection ändrats och kräver nu approval? Merga manuellt.

### Merge-konflikt i Dependabot-PR

Dependabot löser konflikter automatiskt vid nästa schemalagda körning. Om inte:
1. `gh pr close <nr> --comment "Stale, superseded by upcoming rebase"`
2. Dependabot skapar ny PR automatiskt

### Dependabot-PR failar på CI

Läs logs -- om det är en regression i paketet, `gh pr close` och vänta på uppströms-fix. Om det är en bug i vår testsvit, fixa den först och låt Dependabot köra om.

### Flera patch-PRs hopar sig

Normalt. Varje merge triggar rebase av övriga. Om de alla är gröna, merga dem sekventiellt (auto-merge sköter det efter första är mergad, men CI måste köra om).

## Relaterade dokument

- `.github/workflows/dependabot-auto-merge.yml` -- workflow
- `.github/dependabot.yml` -- schema och konfiguration
- `docs/security/license-audit-2026-04-15.md` -- licensgranskning av dependencies
