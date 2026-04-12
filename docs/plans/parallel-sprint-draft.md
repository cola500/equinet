---
title: "Draft: Parallell sprint-körning"
description: "Utkast till ändringar i auto-assign.md och autonomous-sprint.md för parallella sessioner"
category: plan
status: draft
last_updated: 2026-04-12
sections:
  - Ändringar i auto-assign.md
  - Ändringar i autonomous-sprint.md
  - Sprint-dokument format
---

# Draft: Parallell sprint-körning

> Detta är ett utkast. Ändringarna appliceras på auto-assign.md och autonomous-sprint.md efter review.

---

## Ändringar i auto-assign.md

### Ny sektion: Roller och kommandon (ersätter befintlig)

```markdown
## Roller och kommandon

Sessioner startas med ett kort kommando:

| Kommando | Vad händer |
|----------|-----------|
| "kör" | Plockar nästa pending story för sin roll |
| "kör S24-1" | Plockar specifik story |
| "kör sprint 24" | Kör ALLA stories för sin domän autonomt |
| "kör ios" | Kör som iOS-utvecklare |
| "kör review" | Tech lead / review |

Om ingen roll anges: default till fullstack.
```

### Ny sektion: Worktree-beslut (efter STOPP-REGLER)

```markdown
## Worktree-beslut (FÖRE första story)

Vid sessionsstart, INNAN du plockar en story:

### Steg 1: Läs status.md Sessioner-tabell

Finns det en ANNAN aktiv session (in_progress)?

### Steg 2: Beslut

**Ingen annan session aktiv:**
- Du är FÖRSTA sessionen
- Jobba i huvudrepot (ingen worktree)
- Registrera dig i Sessioner-tabellen: roll, domän, branch, startad

**En annan session ÄR aktiv:**
- Du är ANDRA sessionen
- Kontrollera domänkompatibilitet (se Domäntaggar nedan)
- Om kompatibel: skapa worktree och jobba där
- Om INTE kompatibel: STOPPA och meddela Johan

### Steg 3: Skapa worktree (bara andra sessionen)

```bash
# Skapa worktree från main
git worktree add ../equinet-<story-id> -b feature/<story-id>-<namn> main

# Installera dependencies i worktree
cd ../equinet-<story-id>
npm install
```

Registrera i status.md (från HUVUDREPOT, inte worktree):
```markdown
| Session B | fullstack | S24-2 (ios) | feature/s24-2-namn | ../equinet-s24-2 | 2026-04-12 |
```

### KRITISKT: Startordning

Sessioner MÅSTE startas SEKVENTIELLT, aldrig samtidigt.

1. Starta session 1 -> vänta tills den har registrerat sig i status.md och plockat sin första story
2. SEDAN starta session 2 -> den läser status.md och ser session 1

**Varför:** Session 2 måste veta vilken domän session 1 arbetar i för att välja en kompatibel domän. Om båda startar samtidigt kan de plocka stories i samma domän -> merge-konflikter.

**Johans rutin:**
1. Terminal 1: `claude` -> "kör sprint 24" -> vänta tills den skriver "Plockar S24-1..."
2. Terminal 2: `claude` -> "kör sprint 24" -> den ser session 1, väljer annan domän
```

### Ny sektion: Domäntaggar

```markdown
## Domäntaggar i sprint-dokumentet

Varje story i sprint-dokumentet MÅSTE ha en domäntagg:

| Domän | Filer som berörs | Kan parallelliseras med |
|-------|-----------------|------------------------|
| `webb` | src/domain/*, src/app/api/*, src/components/*, e2e/* | `ios`, `docs` |
| `ios` | ios/Equinet/* | `webb`, `docs` |
| `docs` | docs/*, .claude/rules/*, CLAUDE.md | `webb`, `ios` |
| `infra` | prisma/*, package.json, scripts/*, .github/* | INGEN (alltid sekventiell) |
| `auth` | src/lib/auth-*, src/app/api/auth/* | INGEN (säkerhetskritiskt) |

**Sprint-dokument format:**

| Story | Domän | Beskrivning |
|-------|-------|-------------|
| S24-1 | webb | Ny booking-feature |
| S24-2 | ios | Native kalender-polish |
| S24-3 | infra | Schema-ändring |
| S24-4 | webb | Review-förbättring |
| S24-5 | docs | Docs-uppdatering |

**Sessionen filtrerar automatiskt:**
- Session 1 (i huvudrepo) tar: S24-1, S24-4 (webb), sedan S24-3 (infra), sedan S24-5 (docs)
- Session 2 (i worktree) tar: S24-2 (ios)
- Session 2 kör BARA stories med sin domän, hoppar över alla andra
```

### Ändring i Steg (ersätt steg 4-6)

```markdown
4. Välj nästa matchande story:
   - Om ensam session: ta nästa pending story (oavsett domän)
   - Om parallell session: ta nästa pending story som matchar DIN domän
   - Hoppa över stories med domän som den andra sessionen äger
5. Registrera dig i status.md Sessioner-tabell (roll, domän, branch, story)
6. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
```

### Ändring i Steg 10 (merge)

```markdown
10. Merge (beror på session-typ):

**Båda sessioner (samma flöde):**
```bash
# 1. Pusha feature branch
git push -u origin feature/<story-id>-<namn>

# 2. Skapa PR via GitHub
gh pr create --base main --head feature/<story-id>-<namn> \
  --title "S<X>-<Y>: kort beskrivning" \
  --body "## Summary\n- ..."

# 3. Vänta på CI (Quality Gates)
# 4. Merga via GitHub
gh pr merge <PR-nummer> --merge --delete-branch
```

**VIKTIGT för worktree-session (session 2):**
- Gör `git pull origin main` i worktreen EFTER att session 1 mergat en PR
- Annars bygger din nästa story på gammal main
- Om du inte behöver session 1:s ändringar, kör vidare utan pull
```

### Ny undantagsregel

```markdown
**Om du är i worktree och alla stories i din domän är klara:**
Meddela Johan: "Alla [domän]-stories klara. Worktree kan mergas."
Vänta -- merga INTE från worktree.
```

---

## Ändringar i autonomous-sprint.md

### Ändrad Trigger-sektion

```markdown
## Trigger

Sessionen startas med "kör sprint X" eller "kör sprint X autonomt".

**En session:** Kör ALLA stories i sprinten sekventiellt.
**Parallella sessioner:** Varje session kör BARA stories som matchar sin domän.

Se `.claude/rules/auto-assign.md` Worktree-beslut för hur sessionen avgör om den är ensam eller parallell.
```

### Ändrat Steg 1 (Plocka story)

```markdown
### 1. Plocka story
- Läs `docs/sprints/status.md` -- vilken är nästa pending?
- **Om parallell session**: filtrera på stories med din domän (se sprint-dokumentets domäntaggar)
- **Hoppa över** stories med annan domän -- den andra sessionen tar dem
- Uppdatera status: story -> `in_progress`
- Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
```

### Ändrat Steg 8 (Merge)

```markdown
### 8. Merge

**Session i huvudrepo:**
```bash
git push -u origin feature/<story-id>-<namn>
git checkout main && git pull origin main
git merge feature/<story-id>-<namn> --no-ff -m "Merge feature/<story-id>: kort beskrivning"
git push origin main
git branch -d feature/<story-id>-<namn>
git push origin --delete feature/<story-id>-<namn>
```

**Session i worktree:**
```bash
# 1. Pusha feature branch
git push -u origin feature/<story-id>-<namn>

# 2. Skapa PR
gh pr create --base main --head feature/<story-id>-<namn> \
  --title "S<X>-<Y>: kort beskrivning" \
  --body "## Summary\n- ..."

# 3. Merga via GitHub (CI måste passera)
gh pr merge <PR-nummer> --merge --delete-branch

# 4. Pull main till worktree innan nästa story
git checkout main && git pull origin main
git checkout -b feature/<nästa-story-id>-<namn>
```

### 9. Nästa story
- Om parallell: gå till steg 1, filtrera på din domän
- Om alla stories i din domän är klara: meddela Johan
- Om ensam: gå till steg 1 som vanligt
```

### Ny sektion: Sprint-avslut vid parallella sessioner

```markdown
## Sprint-avslut vid parallella sessioner

Varje session avslutar SIN del:
1. Done-filer skrivna för alla sina stories
2. Status.md uppdaterat för alla sina stories
3. `npm run check:all` grön i sin worktree/repo
4. Meddela Johan: "Alla [domän]-stories klara"

**Alla PRs redan mergade via GitHub** -- varje session skapar PR och mergar per story.

**Worktree-sessionen rensar efter sig** automatiskt när alla stories i sin domän är klara:
```bash
# Sista steget i worktree-sessionens avslut:
cd ~/Development/equinet
git worktree remove ../equinet-s24-2
```

**Johan behöver inte göra något.** Båda sessionerna sköter hela sitt flöde: worktree-skapande, implementation, PR, merge, cleanup.

**Sprint-retro och docs-uppdatering** körs EFTER båda sessionerna är klara, i huvudrepot.
```

---

## Sprint-dokument format (template)

Sprintdokumentet behöver en domäntagg per story:

```markdown
## Stories

| Prio | Story | Domän | Effort | Beskrivning |
|------|-------|-------|--------|-------------|
| 1 | S24-1 | webb | 2h | Booking-feature |
| 2 | S24-2 | ios | 1h | Native polish |
| 3 | S24-3 | infra | 30m | Schema-ändring (SEKVENTIELL) |
| 4 | S24-4 | webb | 1h | Review-förbättring |

### Parallelliseringsplan

Session 1 (huvudrepo): S24-1 -> S24-4 -> S24-3 (webb + infra, sekventiellt)
Session 2 (worktree):  S24-2 (ios)

**Startordning:** Session 1 FÖRST. Vänta tills den registrerat sig. SEDAN session 2.
```
