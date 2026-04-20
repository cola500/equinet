---
title: "Auto-assign vid sessionsstart"
description: "Automatisk tilldelning av stories, med stöd för parallella sessioner och domänfiltrering"
category: rule
status: active
last_updated: 2026-04-18
tags: [workflow, team, automation, parallel]
sections:
  - Roller och kommandon
  - STOPP-REGLER
  - Worktree-beslut
  - Domäntaggar
  - Steg
  - Rollspecifika regler
  - Undantag
---

# Auto-assign vid sessionsstart

## Roller och kommandon

| Kommando | Vad händer |
|----------|-----------|
| "kör" | Plockar nästa pending story för sin roll |
| "kör S24-1" | Plockar specifik story |
| "kör sprint 24" | Kör ALLA stories för sin domän autonomt |
| "kör ios" | Kör som iOS-utvecklare |
| "kör review" | Tech lead / review |

Om ingen roll anges: default till fullstack.

## STOPP-REGLER (bryt ALDRIG dessa)

1. **Pusha ALDRIG till main.** Alltid feature branch + PR.
2. **Implementera ALDRIG innan planen är godkänd.** Committa planen, kör self-review med relevanta subagenter (se `.claude/rules/autonomous-sprint.md` review-matris). Om inga blockerare: planen är godkänd, kör vidare. Om blockerare: fixa och kör review igen. Fråga Johan BARA vid produktbeslut eller scope-oklarheter.
3. **Uppdatera ALLTID din sessionsfil vid varje commit** (se Sessionsfil nedan).

---

## Worktree-beslut (FÖRE första story)

Vid sessionsstart, INNAN du plockar en story:

### Steg 1: Läs status.md Sessioner-tabell

Finns det en ANNAN aktiv session (in_progress)?

### Steg 2: Beslut

**Ingen annan session aktiv:**
- Du är FÖRSTA sessionen
- Jobba i huvudrepot (ingen worktree)
- Registrera dig i Sessioner-tabellen med din domän

**En annan session ÄR aktiv:**
- Du är ANDRA sessionen
- Läs sprint-dokumentets domäntaggar (se nedan)
- Identifiera vilken domän den andra sessionen äger
- Välj en ANNAN domän -- du får BARA ta stories med din domän
- Skapa worktree:
  ```bash
  git worktree add ../equinet-<sprint>-<domän> -b feature/<story-id>-<namn> main
  cd ../equinet-<sprint>-<domän>
  npm install
  ```
- Skapa din sessionsfil (se Sessionsfil ovan)

### Sessionsfil (ersätter status.md-uppdateringar)

Varje session skapar och uppdaterar sin EGEN fil: `docs/sprints/session-<sprint>-<domän>.md`

```markdown
---
sprint: 24
domain: webb
model: opus
started: 2026-04-12
---
| Story | Status | Branch | Commit |
|-------|--------|--------|--------|
| S24-1 | done | feature/s24-1-booking-validation | abc123 |
| S24-2 | in_progress | feature/s24-2-manual-booking | - |
```

**Regler:**
- Skriv BARA till din sessionsfil -- aldrig till `status.md` eller den andra sessionens fil
- Uppdatera vid varje story-byte (pending -> in_progress -> done)
- Tech lead konsoliderar till `status.md` vid merge/avslut

### KRITISKT: Startordning

Session 1 MÅSTE ha registrerat sig i status.md INNAN session 2 startar. Om status.md Sessioner-tabell är tom och du inte är ensam -- STOPPA och fråga Johan.

---

## Domäntaggar

Varje story i sprint-dokumentet har en domäntagg i kolumnen "Roll" eller "Domän":

| Domän | Filer som berörs | Kan parallelliseras med |
|-------|-----------------|------------------------|
| `webb` | src/domain/*, src/app/api/*, src/components/*, e2e/* | `ios`, `docs` |
| `ios` | ios/Equinet/* | `webb`, `docs` |
| `docs` | docs/*, .claude/rules/*, CLAUDE.md, src/lib/help/* | `webb`, `ios` |
| `infra` | prisma/*, package.json, scripts/*, .github/* | INGEN (alltid sekventiell) |
| `auth` | src/lib/auth-*, src/app/api/auth/* | INGEN (säkerhetskritiskt) |

**Hur du hittar din domän:**
1. Läs sprint-dokumentet -- varje story har domäntagg
2. Läs status.md -- vilken domän äger den andra sessionen?
3. Ta stories med en domän som INTE krockar (se tabellen ovan)

**Om en story har domän `infra` eller `auth`:** Den kan INTE köras parallellt. Bara session 1 (huvudrepo) tar den, efter att parallella stories är klara.

---

## Docs-matris (vilka docs måste uppdateras)

| Story-typ | Docs som MÅSTE uppdateras |
|-----------|----------------------------|
| Ny säkerhetsfunktion (MFA, auth, härdning) | README.md (Säkerhet), NFR.md (relevant NFR-rad), `docs/security/<feature>.md`, `docs/operations/incident-runbook.md` (om operativa implikationer), **hjälpartikel** (`src/lib/help/articles/<roll>/<slug>.md`) om det påverkar slutanvändare |
| Ny feature med användarvänd UI | README.md (Implementerade Funktioner), `docs/guides/feature-docs.md`, **hjälpartikel** för relevant roll (leverantör/kund/admin), **admin testing-guide** (`docs/testing/testing-guide.md`) med test-scenario |
| Schema-ändring | `docs/architecture/database.md`, `prisma/schema.prisma` |
| Ny ops-procedur (CI, deploy, monitoring) | `docs/operations/<procedur>.md` |
| Ny arkitekturkomponent | `docs/architecture/<komponent>.md`, CLAUDE.md snabbreferens |
| Ny gotcha eller mönster | CLAUDE.md Key Learnings eller `.claude/rules/<domän>-learnings.md` |
| Beteendeändring i befintlig feature | README.md + relevant feature-doc + **hjälpartikel** (uppdatera befintlig om beteendet ändras synligt) + **testing-guide** (uppdatera relevant scenario) |
| Testantal över 50+ ändrat | README.md (Testning-sektion), NFR.md (Testning) |
| Borttagen feature | README.md (ta bort rad), `docs/guides/feature-docs.md`, **hjälpartikel** (deprecate eller ta bort), **testing-guide** (ta bort scenario) |

**Regel:** Vid done-fil måste sessionen lista vilka docs som uppdaterats. Om ingen -- motivera varför ("ren intern refactoring, ingen användarvänd ändring").

**Content ska matcha kod:** När en feature påverkar vad användaren ser eller gör -- hjälpartiklar och testing-guide är INTE valfria att uppdatera. Det är samma principiell nivå som att skriva tester för ny logik.

**Varning-hook:** Pre-commit och pre-push kör `scripts/check-docs-updated.sh` som varnar om `docs/done/<story>-done.md` inte listar docs-uppdateringar för säkerhets-/feature-stories.

---

## Steg

1. Läs `docs/sprints/status.md` -- vilka stories är pending?
2. Läs det aktiva sprint-dokumentet (länkat i status.md) -- vad är detaljerna?
3. **Worktree-beslut** (se ovan) -- ensam eller parallell?
4. Välj nästa matchande story:
   - **Ensam session:** ta nästa pending story (oavsett domän)
   - **Parallell session:** ta nästa pending story som matchar DIN domän. Hoppa över alla stories med annan domän.
5. Skapa/uppdatera din sessionsfil (roll, domän, branch, story)
6. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
7. Skriv en kort plan i `docs/plans/<story-id>-plan.md` och committa den
   - Vilka filer ändras/skapas
   - Approach (vilka steg, i vilken ordning)
   - Risker eller oklarheter
   - Committa planen FÖRE implementation så tech lead kan läsa den
8. Börja arbeta enligt stationsflödet (.claude/rules/team-workflow.md)
9. När klar: skriv `docs/done/<story-id>-done.md` med:
   - Acceptanskriterier från sprint-dokumentet -- bocka av varje
   - Definition of Done (från CLAUDE.md) -- bocka av varje
   - **Reviews körda** (OBLIGATORISKT -- strukturerat format, maskinläsbart av S47-1 hook):

     ```markdown
     ## Reviews körda

     <!-- Strukturerat format. Alla obligatoriska (per review-matrix.md) måste vara [x]. -->

     - [x] code-reviewer — <sammanfattning>
     - [x] security-reviewer — <sammanfattning>
     - [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
     - [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
     - [ ] tech-architect — ej tillämplig (ingen arkitekturändring)
     ```

     **Trivial story?** Skippa review -- se `.claude/rules/team-workflow.md` Station 4 Review-gating.
     Skriv: `- [ ] code-reviewer — ej tillämplig (trivial story: <motivering>)`
   - **Docs uppdaterade** (OBLIGATORISKT enligt storyns typ -- se Docs-matris nedan):
     - [ ] README.md om ny feature syns för användare
     - [ ] NFR.md om säkerhet/prestanda/reliability-krav påverkas
     - [ ] CLAUDE.md om nya key learnings eller mönster
     - [ ] docs/security/* om auth/säkerhetsfunktion
     - [ ] docs/operations/* om ops-procedur påverkas (inkl. incident-runbook)
     - [ ] docs/architecture/* om arkitekturbeslut
     - Skriv: "Uppdaterade: NFR-14, README, docs/security/mfa-admin.md" eller "Ingen docs-uppdatering (intern refactoring)"
   - **Verktyg använda** (OBLIGATORISKT -- vi mäter effektivitet av docs-katalogen):
     - Läste patterns.md vid planering: ja / nej / N/A (trivial)
     - Kollade code-map.md för att hitta filer: ja / nej / N/A (visste redan)
     - Hittade matchande pattern? Vilket? (t.ex. "Webhook idempotency") eller "nej"
     - Varför: efter 10 stories utvärderar vi om katalogen faktiskt ger värde.
   - **Arkitekturcoverage** (OBLIGATORISKT om story implementerar tidigare design):
     - Designdokument: `<länk>`
     - Alla numrerade beslut implementerade: ja / nej (lista gap om nej)
     - Varför: tvingar explicit coverage-verifiering istället för att anta att "acceptanskriterier räcker".
   - **Modell** (OBLIGATORISKT -- för framtida modellval-metric):
     - Skriv: `opus` / `sonnet` / `haiku`
     - Varför: jämför kvalitet, cykeltid och kostnad per modell. Efter 10+ stories per modell: beslut om standard per story-typ.
   - Avvikelser eller kända begränsningar
   - **Lärdomar**: Vad var oväntat? Vad skulle du göra annorlunda? Gotchas för framtida sessioner?
   - **SAMTIDIGT:** Uppdatera din sessionsfil: story -> `done` + commit-hash
   - Committa BÅDA filerna i samma commit
10. Merge via PR:
    ```bash
    git push -u origin feature/<story-id>-<namn>
    gh pr create --base main --head feature/<story-id>-<namn> \
      --title "S<X>-<Y>: kort beskrivning" \
      --body "## Summary\n- ..."
    gh pr merge <PR-nummer> --merge --delete-branch
    ```
11. Gå till nästa pending story i din domän (steg 4)
12. **Om alla stories i din domän är klara:**
    - Meddela Johan: "Alla [domän]-stories klara."
    - **Om du jobbar i worktree:** rensa efter dig:
      ```bash
      cd ~/Development/equinet
      git worktree remove ../equinet-<sprint>-<domän>
      ```

### Rollspecifika regler

**Fullstack:**
- Verifiering: `npm run check:all`
- Tester: Vitest (BDD dual-loop för API/services)
- Review-agenter: security-reviewer (API), cx-ux-reviewer (UI)

**iOS:**
- Verifiering: `xcodebuild test` (se `.claude/rules/ios-learnings.md`)
- Följ iOS Native Screen Pattern (se CLAUDE.md)
- Review-agenter: ios-expert, mobile-mcp för visuell verifiering
- Tester: XCTest för ViewModels, visuell verifiering för UI
- VIKTIGT: Verifiera auth-mekanism (Bearer JWT vs session) innan native UI anropar endpoints

**Tech lead / review:**
- Läs `git log` och `git diff` för senaste commits
- Läs `status.md` för vilka stories som är in_progress
- Kör code-reviewer agent på ändringarna
- Uppdatera status.md med review-resultat

## Undantag

**Om alla stories för din roll/domän är klara eller blockerade:**
Rapportera till Johan: "Alla [roll/domän]-stories i [sprint] är klara/blockerade. Vad vill du prioritera?"

**Om en story redan är in_progress av en annan session:**
Hoppa över den. Ta nästa pending story i din domän. Raska ALDRIG en story från en aktiv session.

**Om du är osäker på scope eller arkitektur:**
Läs sprint-dokumentets detaljerade uppgifter. Om det inte räcker -- fråga Johan.
