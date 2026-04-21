---
name: update-docs
description: Systematiskt uppdatera dokumentation efter en feature-implementation
argument-hint: "<kort beskrivning av feature, t.ex. 'offline mutation queue'>"
---

Uppdatera dokumentation efter implementation av: **$ARGUMENTS**

## 1. Inventera ändringar

Kör dessa parallellt för att förstå vad som ändrats:

```bash
git log --oneline -20         # Senaste commits
git diff main --stat          # Ändrade filer (om på feature branch)
npm run test:run -- --reporter=dot 2>&1 | tail -5  # Testantal
```

Kolla också review-matrisen för att veta vilka docs-kategorier ändringen triggar:

```bash
cat .claude/rules/review-matrix.md
cat .claude/rules/auto-assign.md  # Docs-matris per story-typ
```

## 2. Checklista — vilka dokument berörs?

Gå igenom varje rad och bedöm. Läs filen FÖRST, redigera sedan.

### Källkods-dokumentation

| Fil | Uppdatera när... |
|-----|------------------|
| `docs/architecture/database.md` | Schema-ändringar (nya tabeller, fält, relationer) |
| `docs/architecture/offline-pwa.md` | Offline-relaterade ändringar (cache, sync, mutations, SW) |
| `docs/architecture/booking-flow.md` | Ändringar i bokningsflöde (status, betalning, avbokning) |
| `docs/architecture/messaging-domain.md` | Ändringar i meddelandedomänen (Conversation, Message) |
| `docs/architecture/messaging-attachments.md` | Ändringar i bild-bilagor (storage, MIME, thumbnails) |
| `docs/architecture/<pattern>.md` | Nytt eller ändrat pattern (gateway, column-level-grant, webhook-idempotency, osv.) |
| `docs/architecture/scaling.md` | Skalnings- eller prestandaändringar |
| `docs/architecture/rls-roadmap.md` | RLS-policy-ändringar |

### Operations

| Fil | Uppdatera när... |
|-----|------------------|
| `docs/operations/environments.md` | Miljö-ändringar (staging, prod, Supabase-projekt, URL:er) |
| `docs/operations/deployment.md` | Deploy-procedur-ändringar |
| `docs/operations/incident-runbook.md` | Nya operativa procedurer efter säkerhetsincident |

### Källor av sanning

| Fil | Uppdatera när... |
|-----|------------------|
| `README.md` | Ny feature, uppdaterat testantal, nya npm scripts, ny URL |
| `NFR.md` | Ny production readiness-kapabilitet, uppdaterat testantal, ny säkerhet |
| `CLAUDE.md` | Ny key learning, ny snabbreferenslänk, nytt Domain Pattern |

### Guider och kunskap

| Fil | Uppdatera när... |
|-----|------------------|
| `docs/guides/feature-docs.md` | Ny eller ändrad användarvänd funktionalitet |
| `docs/guides/gotchas.md` | Ny gotcha upptäckt under implementation |

### Regler (påverkar AI-beteende)

| Fil | Uppdatera när... |
|-----|------------------|
| `.claude/rules/review-matrix.md` | Ny filtyp som kräver specifik reviewer |
| `.claude/rules/review-manifest.md` | Ny domän-specifik "kom-ihåg"-lista |
| `.claude/rules/auto-assign.md` | Ändrad Docs-matris (vilka docs som MÅSTE uppdateras per story-typ) |
| `.claude/rules/testing.md` | Nytt test-mönster eller gotcha |
| `.claude/rules/ios-learnings.md` | iOS-specifik lärdom |

### Lifecycle-docs (ofta per story, inte per skill-körning)

| Fil | Uppdatera när... |
|-----|------------------|
| `docs/plans/*.md` | Planerade features som nu är implementerade — markera som KLAR |
| `docs/done/<story>-done.md` | Per story (automatiskt om story följer stationsflödet) |
| `docs/ideas/*.md` | Om idén delvis eller helt implementerad, uppdatera status |

## 3. Utför uppdateringar

För varje relevant fil:

1. **Läs filen FÖRST** — förstå befintlig struktur och stil
2. **Redigera minimalt** — ändra bara det som behövs, behåll filens format
3. **Uppdatera testantal** bara om det ändrats signifikant (20+ nya tester)
4. **Uppdatera `last_updated:`** i YAML-frontmatter till dagens datum

### Nyckelprinciper

- **Läs ALLTID filen innan redigering** (Edit-verktyget kräver det)
- **Behåll filens befintliga stil och format** — inte omskrivning
- **Svenska med korrekta å, ä, ö i all text** (utom MEMORY.md)
- **Skapa nya docs-filer med disciplin:**
  - ✅ OK att skapa: retros via `/retro`, audit-rapporter, pilot-rapporter, design-dokument, idé-dokument i `docs/ideas/`
  - ❌ Inte OK utan diskussion: nya kategorier, ersättning av befintliga docs (undvik dubbletter som S48-1 hade)
- **Länka till befintliga filer** med relativa sökvägar

## 4. Verifiera

```bash
npm run check:all          # Allt-i-ett: typecheck + test + lint + swedish
npm run docs:validate      # Frontmatter-validering (om den finns)
npm run test:hooks         # Verifiera hook-svit (om hooks rörts)
```

Kontrollera manuellt att:

- Alla fil-ankare pekar på filer som faktiskt finns
- Testantal är konsistenta mellan README.md, NFR.md och CLAUDE.md
- Inga dubbla eller motstridiga uppgifter i olika dokument
- Inga dubbletter (t.ex. samma `environments.md` på flera platser)

## 5. S47-hooks-medvetenhet

Pre-commit-hooks kan blockera dina commits. För lifecycle-docs-ändringar på main:

- **`check-branch-for-story.sh`** blockerar kod-commits på main när story in_progress → docs-ändringar är lifecycle, vilket passerar utan override
- **`check-reviews-done.sh`** triggar bara om done-fil staged — påverkar inte ren docs-uppdatering
- **`check-plan-commit.sh`** triggar bara om story in_progress utan plan — docs-ändringar påverkas inte

Om en hook ändå triggar felaktigt: lägg till `[override: <motivering>]` i commit-message-subject. Motiveringen ska vara specifik (t.ex. `[override: docs-sync efter sprint-avslut]`).

## 6. Commit-strategi

Per `.claude/rules/commit-strategy.md`:

- **Lifecycle-docs** (retros, done-filer, status.md) → direkt till main tillåtet
- **Rule-docs, CLAUDE.md, README.md, NFR.md, arkitektur** → kräver feature branch + PR

Om skill-körningen uppdaterar både lifecycle och rule-docs → PR-flödet gäller.
