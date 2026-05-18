---
title: Sprint 3-A Follow-up Retro
description: Kort retro för post-3A watch-items genomförda 2026-05-18. Tre slices (3A.fu.1-3) över bucket-infra, message-routes och upload-ownership. Naming-rensning från "3B" till "3A follow-up".
category: retrospective
status: active
last_updated: 2026-05-18
tags: [security, sprint-3a-followup, hardening, uploads, messaging, buckets]
related:
  - docs/retrospectives/2026-05-18-sprint-3a-security-remediation.md
  - docs/security/security-sprint-continuity-2026-05.md
  - docs/security/remediation-backlog-fixes-txt-2026-05.md
sections:
  - Sammanfattning
  - Vad vi gjorde
  - Varför "Sprint 3-A follow-up" istället för "Sprint 3-B"
  - Vad som fungerade bra
  - Vad som var förvirrande
  - Lärdomar
  - Kvarvarande slices
  - Rekommenderad nästa återstartspunkt
---

## Sammanfattning

Tre HIGH-prio watch-items från Sprint 3-A:s retro genomförda 2026-05-18 över ~3-4h. Alla mergade till `staging` och verifierade via smoke. Ingen prod-touch. Sprint pausad efter 3 av 6 follow-up-slices klara.

| Slice | Vad | PR | Merge-commit |
|-------|-----|----|--------------|
| **3A.fu.1** | Verifiera `message-attachments`-bucket i staging-Supabase | — (ingen kodändring) | — |
| **3A.fu.2** | UUID-validera `bookingId` i messages-routes (4 handlers) | #338 | `9e6cb2a7` |
| **3A.fu.3** | Services-bucket ownership i `/api/upload` | #339 | `a2ba326b` |

## Vad vi gjorde

### 3A.fu.1 — Bucket-verifiering (ingen kodändring)

Bekräftade att `message-attachments`-bucken existerar i staging-Supabase via autentiserad upload-smoke (POST `/api/bookings/<uuid>/messages/attachments` → 201). Tidigare publik probe gav `"Bucket not found"` — men det är Supabase's standardrespons för privata buckets, inte saknad bucket. Värdefull operational-clarifying utan kodändring.

### 3A.fu.2 — UUID-validering av `bookingId`

Lade till `z.string().uuid()`-check direkt efter feature-flag-check och före rate-limit i 4 handlers (`messages` POST + GET, `messages/read` PATCH, `messages/attachments` POST). Defense-in-depth-parity med C3:s `entityId`-validering. Befintliga fixturer (`'booking-abc-123'`, `'booking-1'`) uppdaterade till UUID v4. 7 nya regression-tester.

### 3A.fu.3 — Services-bucket ownership

`/api/upload` saknade ownership-check för `bucket: services` — vilken inloggad användare som helst kunde ladda upp till valfri provider's namespace. Stängt via `entityId === session.user.providerId` exact match → 403 vid mismatch. 3 nya regression-tester (T6 främmande UUID, T7 egen, T8 customer-session).

## Varför "Sprint 3-A follow-up" istället för "Sprint 3-B"

Min initial-planering kallade slices "3B.1, 3B.2, 3B.3" — men `remediation-backlog-fixes-txt-2026-05.md` reserverar redan namnet **"Sprint 3-B"** för **H1, H4, H7, H10** HIGH-fynd från fixes.txt. Två olika definitioner av samma sprintnummer skapade konflikt.

**Lösning:** Genomförda slices omdöpta till "Sprint 3-A follow-up" (3A.fu.1, 3A.fu.2, ...) eftersom de adresserar **watch-items från Sprint 3-A:s retro**, inte de HIGH-fynd från fixes.txt som backlog-doc:s Sprint 3-B är reserverat för. Backlog-doc:s Sprint 3-B (H1-H10) förblir pending och separat.

**Lärdom:** Bekräfta sprint-namespace mot befintlig backlog INNAN slices namnges. En 5-sekunders `grep -n "Sprint 3-B"` hade fångat konflikten i planeringsfasen.

## Vad som fungerade bra

- **Sub-slice-storlek**: 3 slices à 30 min-1h, varje med egen PR och egen smoke. Granular nog för rollback per slice.
- **RED→GREEN-disciplin**: Alla nya tester körda före implementation. RED-fasen visade exakt vilka tester som faktiskt fångar regressioner (T2 i C3 visade samma mönster — vissa "förvänta-fail"-tester passerar redan, vilket är information om att specifik vektor inte gick att exploatera idag).
- **Live smoke per slice**: Playwright + inloggad session som Erik gav direkt feedback efter varje deploy. 8 scenarier mot messages-routes (3A.fu.2) bekräftade att inga happy paths regressade.
- **MCP-säkerhetscheck före åtgärd**: Att stoppa och be om manuell bucket-skapande när MCP pekade på prod istället för staging undvek potentiell prod-störning. Sprint sparat ~5-10 min av panik.

## Vad som var förvirrande

- **Sprint-namnkonflikt**: Beskriven ovan. Två "Sprint 3-B"-definitioner skapade dokumentations-skuld som krävde retro-rensning.
- **Privata buckets vs publik probe**: Min initial-hypotes att privata Supabase-buckets ger `"Object not found"` på publik probe var fel — de ger `"Bucket not found"` (för att inte läcka existens). Ledde till felsignal att `message-attachments` saknades.
- **Pre-existing 500 i C3-smoke som inte var C3-regression**: Slutet av Sprint 3-A:s smoke visade 500 på normal upload — antogs vara infra-issue, vilket bekräftades först via runtime-logs och senare Supabase MCP. Adresserades av denna sprints 3A.fu.1 indirekt (genom att skapa staging-buckets).
- **Pre-existing lint-warning** (`deleteMessageAttachment` defined but never used) — flaggades flera gånger som "se över i 3A.fu.4" men adresseras inte i någon av dessa slices. Risk för glömska om inte explicit hanterad.

## Lärdomar

### entityId-semantik för uploads (Option A vs B)

Innan 3A.fu.3 implementerades begärdes scope-klargörande: är `entityId` för `bucket: services` menat som **providerId** (namespace-prefix, Option A) eller **serviceId** (entity-koppling med auto-update av `Service.imageUrl`, Option B)? Skillnaden styr hela ownership-check-strategin.

**Beslut:** Option A — providerId namespace. Detta matchar befintliga buckets (`avatars`, `horses`, `verifications`) som också använder entitets-ID för path-prefix utan att alltid koppla till specifik DB-rad.

**Lärdom:** För upload-routes som accepterar `entityId` — dokumentera explicit i route-koden VAD `entityId` representerar och vilken ownership-invariant som gäller. Inline-kommentar med "// 3B.3: providerId namespace — entityId MUST equal session's own providerId" finns nu i `upload/route.ts`. Bör appliceras på övriga buckets retroaktivt i framtida hygien-slice.

### Privata buckets och korrekt smoke-test

Publik HTTP-probe mot Supabase Storage REST API är **inte definitivt test** för om en privat bucket existerar. Båda "bucket saknas" och "bucket finns men privat" returnerar `404 Bucket not found` på publik endpoint.

**Korrekt verifiering för privat bucket:**
1. Authenticated upload via app-routen (kräver inloggad session) → 201 bekräftar både bucket-existens OCH att service-role-key fungerar
2. Eller direkt SQL-query `SELECT id FROM storage.buckets WHERE id = ...` (kräver Supabase Dashboard SQL Editor eller MCP pekad på rätt projekt)

**Korrekt verifiering för publik bucket:**
- Publik probe fungerar och kan skilja "bucket finns men objekt saknas" (`"Object not found"`) från "bucket saknas" (`"Bucket not found"`)

Dokumentera dessa två probe-mönster i framtida storage-felsökningsguide.

### MCP/Playwright-targeting och säker verifiering

**Supabase MCP defaultar inte alltid till önskat projekt.** I denna sprint upptäcktes (i föregående 3-A-arbete) att MCP-anslutningen pekade på **prod-Supabase** (`xybyzflfxnqqyxnvjklv`) trots att alla operationer var avsedda för **staging** (`zzdamokfeenencuggjjp`). När user bad mig skapa buckets i staging hade ett MCP-anrop utan check skrivit i prod.

**Skyddspattern (etablerat i denna sprint):**
1. **Alltid** kör `mcp__supabase__get_project_url` som första call när Supabase MCP används
2. Verifiera att returnerad URL matchar förväntat projekt
3. Vid mismatch — stoppa och rapportera, be om manuell Dashboard-åtgärd eller MCP-omkonfiguration
4. Aldrig anta att tidigare session's MCP-config gäller i ny session

**Playwright-browser-state är säkrare** — den körs alltid mot URL som anges i `browser_navigate`. Risken är istället att glömma att vissa interaktioner skapar verklig data (test-meddelanden, test-bokningar) som inte enkelt kan rensas via API. Cleanup-not behövs ofta efter smoke.

## Kvarvarande slices

Tre items från Sprint 3-A:s retro inte adresserade i denna follow-up:

| Slice | Severity | Effort | Anledning till skjutning |
|-------|----------|--------|-------------------------|
| **3A.fu.4** Sanera `Upload.originalName` (truncate + strip control chars) | MEDIUM | ~30 min | Ingen känd exploit; React auto-eskaperar nuvarande consumers. Defense-in-depth-värde men inte HIGH |
| **3A.fu.5** Bucket-parity prod ↔ staging (limits + MIME-restrict på prod's `equinet-uploads`) | MEDIUM | 10 min + verifiering | **Touches production infrastructure** — kräver godkännande och fönster, inte spontant |
| **3A.fu.6** Dev-fallback fail-loud i NODE_ENV=production | LOW | ~20 min | Hygien-cleanup, ingen aktuell brist |

Och **pre-existing lint-warning** `deleteMessageAttachment defined but never used` i `attachments/route.ts:20` — kan adresseras i 3A.fu.4 (samma fil) eller separat hygien-slice.

## Rekommenderad nästa återstartspunkt

**Beslutsträd för nästa session:**

1. **Om prod-merge nära** → Sprint 3-B (H1, H4, H7, H10 från fixes.txt). Detta är backlog-doc:s BLOCKER för prod.
2. **Om iOS native-rebuild fortsätter och säkerhets-aktivitet pausas** → Inget mer i 3-A-spåret behövs. Kvarstående 3A.fu.4-6 låg risk för förfall.
3. **Om Stripe live-flow planeras** → Sprint 3-B + Manuell-3 (test-kort).
4. **Om publik demo planeras** → Sprint 3-D (S-1 + S-3 AI cost-control).
5. **Om vi vill stänga sista 3-A-watch-items innan kontextbyte** → 3A.fu.4 originalName-sanering (~30 min, lågrisk, ingen prod-touch).

**Default-rekommendation:** alternativ **5** vid nästa korta session, **2** om längre paus förväntas. Sprint 3-B kräver dedicerat tidsblock (~5h) och bör inte påbörjas utan klart prod-merge-mål.

## Status

- **Branch staging:** `a2ba326b` — alla Sprint 3-A + 3-A follow-up HIGH live
- **Branch main:** orörd
- **Production:** ingen deploy utfärdad
- **Sprint pausad:** ja
