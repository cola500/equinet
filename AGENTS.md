# AGENTS.md -- Teaminstruktioner for Equinet

> Denna fil styr hur alla Claude-sessioner samarbetar i projektet.
> CLAUDE.md ar den tekniska referensen. Denna fil ar den organisatoriska.
>
> **Grundprincip: Processen evolverar varje sprint.** Inget arbetssatt ar permanent.
> Varje sprint-retro identifierar vad som inte fungerar och fixar det.
> Om en regel hindrar mer an den hjalper -- andra den.

## Roller

### Tech Lead (Claude Opus)

- **Ansvar**: Arkitekturbeslut, code review, prioritering, kvalitetsgates
- **Nar**: Nya features, refaktorering, sakerhetsbedomningar, sprint-planering
- **Befogenheter**: Kan godkanna merges, avvisa implementation, eskalera till Johan

### Fullstack-utvecklare (Claude)

- **Ansvar**: Implementation av features, bugfixar, testskrivning
- **Nar**: User stories fran sprint-dokumentet
- **Begransningar**: Foljer stationsfloden (se nedan), far inte merga utan review

### iOS-utvecklare (Claude)

- **Ansvar**: Swift/SwiftUI-implementation, native-migrering, bridge-protokoll
- **Nar**: iOS-specifika features, native screen-konverteringar
- **Begransningar**: Foljer iOS Native Screen Pattern (se CLAUDE.md)

### Specialistagenter

- **security-reviewer**: Kallas EFTER implementation av API-routes eller auth-andringar
- **cx-ux-reviewer**: Kallas EFTER implementation av UI-andringar
- **tech-architect**: Kallas FORE implementation av nya features med arkitekturpaverkan
- **code-reviewer**: Kallas vid station 4 (Review) i stationsfloden
- **ios-expert**: Kallas vid SwiftUI-implementation for kodgranskning

---

## Stationsflode (obligatoriskt for alla features)

Varje feature passerar genom 6 stationer i ordning.
Detaljerade checklistor finns i `.claude/rules/team-workflow.md`.

```
1. PLAN    -- Design, schema, API-kontrakt (fran sprint-dokumentet).
2. RED     -- Failande tester skrivna (TDD). Inga implementationsandringar.
3. GREEN   -- Minimum implementation for att passera tester.
4. REVIEW  -- AUTOMATISK: code-reviewer + security/ux/ios-agenter vid behov.
5. VERIFY  -- check:all (webb) eller xcodebuild test (iOS). Alla gates grona.
6. PUSH    -- Pusha FEATURE BRANCH (aldrig main). Status -> "review_requested".
7. MERGE   -- Tech lead granskar och mergar till main.
```

**Station 1-6 ar autonoma.** Utvecklare kor utan att fraga.
**Station 7 ar tech lead-granskning.** Triggas via "kor review".

**VIKTIGT: En branch at gangen.** Alla sessioner delar samma working directory.
Kor en session, lat den bli klar, kor review, sedan nasta. Aldrig parallella sessioner.

**Regler:**
- Hoppa ALDRIG over en station
- Committa efter varje station (sa vi kan rulla tillbaka)
- Om review hittar problem -- tillbaka till station 3
- Om verify failar -- tillbaka till station 3
- Pusha ALDRIG direkt till main -- alltid feature branch

---

## Kommunikation mellan sessioner

### Live-status (docs/sprints/status.md) -- OBLIGATORISK

`docs/sprints/status.md` ar teamets delade tillstand. **Alla sessioner MASTE uppdatera den vid varje commit.**

Filen innehaller:
- Story-status per sprint (pending/in_progress/done)
- Aktiva sessioner (vem gor vad pa vilken branch)
- Beslut som paverkar andra sessioner
- Blockerare

**Workflow:**
1. Las `status.md` vid sessionstart -- vad pagar? Vilka branches finns?
2. Uppdatera "Sessioner"-tabellen med din roll och branch
3. Vid varje commit: uppdatera story-status och senaste commit-hash
4. Vid sessionsslut: rensa din rad fran Sessioner-tabellen

En Claude Code hook (`sprint-status-update.sh`) paminner vid commit om filen inte ar staged.

### Sprint-dokument (docs/sprints/)

Alla sessioner refererar till det aktiva sprint-dokumentet.
Sprint-dokumentet innehaller:
- User stories med acceptanskriterier
- Detaljerade uppgifter per story
- Prioritetsordning

### Git ar kommunikationskanalen

Tech lead laser `git log`, `git diff` och `status.md` for att folja arbetet.
Utvecklare behover inte rapportera separat -- committa, uppdatera status.md, pusha.

### Branch-konvention

```
feature/<story-id>-<kort-beskrivning>    # Ny feature
fix/<story-id>-<kort-beskrivning>        # Buggfix
refactor/<beskrivning>                    # Refaktorering
```

En branch = en story. Blanda ALDRIG arbete fran olika stories.

### Overgangsinformation

Nar en session avslutas, lamna:
1. Uppdaterad `docs/sprints/status.md` (rensa din session-rad)
2. Retro i `docs/retrospectives/` (vid storre arbete)
3. Commit med tydligt meddelande om var arbetet stannade

---

## Kvalitetsregler

### Alla sessioner MASTE

1. **Lasa CLAUDE.md** innan arbete paborjas
2. **Folja TDD** -- tester FORE implementation (BDD dual-loop for API/services)
3. **Kora verifiering** innan "klart" deklareras:
   - Webb: `npm run check:all` (typecheck + test + lint + swedish)
   - iOS: Relevant testsvit (se CLAUDE.md Niva 1/2)
4. **Committa efter varje station** -- ocommittade andringar kan forsvinna
5. **Anvanda strukturerad loggning** -- `logger`/`clientLogger`/`AppLogger`, ALDRIG `console.*`

### Ingen session far

- Merga till main utan att alla gates ar grona
- Andra arkitektur utan tech lead-granskning
- Lagga till dependencies utan motivering
- Pusha till remote utan Johans OK
- Skippa red-steget i TDD

---

## Eskalering

| Situation | Eskalera till |
|-----------|--------------|
| Arkitekturfragor | Tech lead (tech-architect agent) |
| Sakerhetsoro | security-reviewer agent + Johan |
| UX-beslut | cx-ux-reviewer agent + Johan |
| Blockerad av beroende | Johan (projektbeslut) |
| Osaker pa scope | Johan (affärsbeslut) |

---

## Prioriterade teknikskulder (tech lead-beslut)

Dessa ska atagaras nar de beror av paborjat arbete, inte som separata sprintar:

1. **withApiHandler-migrering** -- 18/159 routes klara. Vid arbete i en route: migrera den.
2. **console.* -> logger** -- 97 forekomster. Vid arbete i en fil: rensa den.
3. **Stora filer** -- BookingService (986 rader). Dela vid nasta feature som beror den.

---

**Senast uppdaterad**: 2026-04-01
