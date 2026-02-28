---
name: wrap-up
description: Session wrap-up with status check, self-improvement analysis, and rule health check
argument-hint: "[kort beskrivning av sessionen, t.ex. 'feature flags refactoring']"
---

Avsluta sessionen för: **$ARGUMENTS**

Analysera sessionen, identifiera förbättringsmöjligheter, kontrollera regelhälsa, och koordinera med /retro och /ship.

**Tidsbudget:** 2-3 minuter totalt. Var koncis.

---

## Fas 1: Sessionstatus

Samla data genom att köra dessa i parallell:

- `git status` (aldrig -uall)
- `git diff --stat` (ändrade filer med rader)
- `git diff --name-only` (bara filnamn för kategorisering)
- `git log --oneline -10` (senaste commits)
- `git stash list` (glömda stashar?)

Från datan, sammanställ:

### Filändringar per lager

Kategorisera ändrade filer i:
- **Schema** (prisma/), **API** (src/app/api/), **Domain** (src/domain/), **Infrastructure** (src/infrastructure/)
- **UI** (src/app/ exkl. api/, src/components/), **Lib** (src/lib/), **Test** (*.test.*, e2e/)
- **Config** (.claude/, docs/, package.json, etc.)

### Uncommitted arbete

- Finns det staged men ej committade ändringar?
- Finns det unstaged ändringar?
- Finns det untracked filer som borde committas?

Presentera som:
```
## Sessionstatus

**Branch:** <branch-namn>
**Ändrade filer:** X filer (+Y/-Z rader)

| Lager | Filer | Status |
|-------|-------|--------|
| API   | 3     | Committade |
| UI    | 2     | Uncommitted |
| ...   | ...   | ... |

**Uncommitted:** X filer med ändringar
**Stashar:** Inga / X stash(ar) hittade
```

---

## Fas 2: Självförbättring

Analysera sessionen genom att besvara dessa 5 frågor (beslutsträd). Dokumentera BARA punkter som klarar filtret.

### Fråga 1: Skill gaps
"Fanns det något jag inte kunde göra, eller behövde fråga användaren om, som jag borde kunna nästa gång?"

**Filter:** Bara om det finns ett konkret, återanvändbart mönster att spara. Skippa engångsföreteelser.

### Fråga 2: Friction
"Var uppstod friktion i arbetsflödet? Tog något onödigt lång tid?"

**Filter:** Bara om friktionen har en systemisk lösning (ny rule, bättre skill, saknad docs). Skippa om det var en engångssituation.

### Fråga 3: Knowledge
"Lärde jag mig något om kodbasen som inte finns dokumenterat?"

**Filter:** Bara om informationen sparar tid i framtida sessioner. Skippa trivia.

### Fråga 4: Patterns
"Använde jag ett nytt mönster som fungerade bra och borde standardiseras?"

**Filter:** Bara om mönstret användes 2+ gånger ELLER är klart överlägset befintliga alternativ.

### Fråga 5: Misstag
"Gjorde jag något misstag som kunde ha undvikits med bättre regler eller docs?"

**Filter:** Bara om en regeländring faktiskt hade förhindrat misstaget. Skippa mänskliga misstag.

Presentera som:
```
## Självförbättring

**Skill gaps:** Inga / <beskrivning>
**Friction:** Ingen / <beskrivning>
**Ny kunskap:** Ingen / <beskrivning>
**Patterns:** Inga / <beskrivning>
**Misstag:** Inga / <beskrivning>
```

---

## Fas 3: Regelhälsocheck

Läs dessa filer och kontrollera:

### 3a. MEMORY.md staleness

Läs `/Users/johanlindengard/.claude/projects/-Users-johanlindengard-Development-equinet/memory/MEMORY.md` och kontrollera:

1. **Testantal** -- Stämmer "~X unit-tester" med verkligheten? Kör `npm run test:run -- --reporter=dot 2>&1 | tail -3` för att verifiera.
2. **"Ej committad"** -- Finns det sessioner markerade som "ej committad" som nu ÄR committade? Kontrollera med `git log --oneline -20`.
3. **Branch-refs** -- Refererar MEMORY.md till branches som inte längre existerar? Kör `git branch -a` för att verifiera.
4. **Sessionslista** -- Är "Senaste sessioner" aktuell? Borde gamla sessioner trimmas (max 5)?

Presentera varje punkt med prefix:
- `[OK]` -- Korrekt, ingen åtgärd behövs
- `[STALE]` -- Inaktuellt, föreslå uppdatering
- `[SAKNAS]` -- Information saknas som borde finnas

### 3b. Rules-filer

Läs filerna i `.claude/rules/` och kontrollera:

1. **Saknade patterns** -- Upptäcktes nya patterns i denna session som borde finnas i en rule-fil?
2. **Motsägelser** -- Motsäger något i rules-filerna det som faktiskt görs i kodbasen?
3. **Nya gotchas** -- Stötte vi på en gotcha som inte finns dokumenterad i `docs/guides/gotchas.md` eller rules?

Presentera med samma prefix: `[OK]`, `[SAKNAS]`, `[KONFLIKT]`

### 3c. CLAUDE.md

Snabbkontroll av `CLAUDE.md`:
1. **Key Learnings** -- Finns sessionens viktigaste lärdom där?
2. **Sprint-info** -- Stämmer "Aktuell Sprint" med verkligheten?

Presentera:
```
## Regelhälsa

### MEMORY.md
- [OK] Testantal: ~1959 stämmer med verkligheten (1962 faktiska)
- [STALE] Session 38 markerad "ej committad" men finns i git log
- [OK] Branch-refs: alla existerar

### Rules
- [OK] Inga saknade patterns
- [SAKNAS] E2E cookie-consent pattern saknas i e2e.md

### CLAUDE.md
- [OK] Key Learnings uppdaterade
- [STALE] Sprint-info refererar till Sprint 1, nu Sprint 2
```

---

## Fas 4: Konsoliderad rapport

Sammanställ fas 1-3 till en överskådlig rapport:

```
# Sessionsrapport: <$ARGUMENTS>

## Status
<Fas 1-sammanfattning i 2-3 rader>

## Förbättringsmöjligheter
<Fas 2-fynd, bara de som passerade filtret>

## Regelhälsa
<Fas 3-fynd, bara [STALE], [SAKNAS], [KONFLIKT]>

## Föreslagna åtgärder
1. <Åtgärd med specifik fil och ändring>
2. <Åtgärd med specifik fil och ändring>
...

## Nästa steg
- [ ] Godkänn regeländringar ovan
- [ ] Kör /retro för retrospektiv-dokument
- [ ] Kör /ship för commit + push
```

**KRITISKT:** Vänta på användarens godkännande innan du går vidare till fas 5. Fråga:
"Vilka åtgärder vill du att jag genomför? Du kan godkänna alla, välja specifika, eller hoppa över."

---

## Fas 5: Exekvera

Baserat på användarens godkännande:

### 5a. Applicera regeländringar

För varje godkänd åtgärd:
- Redigera den specifika filen (MEMORY.md, rules, CLAUDE.md, GOTCHAS.md)
- Var minimal och kirurgisk -- ändra bara det som behövs
- Använd korrekta å, ä, ö i alla svenska texter

### 5b. Erbjud /retro

Om sessionen hade substantiellt arbete (nya features, buggfixar, etc.):
"Vill du att jag kör /retro för att skapa ett retrospektiv-dokument?"

Om användaren säger ja, kör `/retro` med sessionsbeskrivningen.

### 5c. Erbjud /ship eller /commit

Om det finns uncommitted ändringar:
"Det finns uncommitted ändringar. Vill du:"
- `/ship` -- Commit + push (kör Husky hooks)
- `/commit` -- Bara commit (ingen push)
- Hoppa över

Om allt redan är committat och pushat, skippa detta steg.

---

## Viktigt

- **Commit/push ALDRIG automatiskt** -- fråga ALLTID användaren
- **Applicera ALDRIG regeländringar utan godkännande** -- presentera, vänta, exekvera
- **Överdriv inte** -- om sessionen var enkel och inget behöver uppdateras, säg det
- **Svenska med korrekta å, ä, ö** i all användarriktad text
- **Tester körs INTE** som del av wrap-up (användaren kan be om det separat)
- Om /retro redan körts denna session, skippa 5b
- Om /ship eller /commit redan körts, skippa 5c
