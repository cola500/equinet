---
title: "Parallella sessioner"
description: "Hur två autonoma sessioner kör samtidigt utan konflikter -- worktrees, domängränser, merge-ordning"
category: rule
status: active
last_updated: 2026-04-12
tags: [workflow, parallel, worktree, team]
paths:
  - "docs/sprints/*"
sections:
  - Översikt
  - Före start
  - Starta parallella sessioner
  - Under körning
  - Merge-protokoll
  - Domängränser
  - Vad som ALDRIG får köras parallellt
  - Felsökning
---

# Parallella sessioner

## Översikt

Två autonoma sessioner kan köra samtidigt om de rör **helt separata domäner**. Varje session arbetar i sin egen git worktree -- en isolerad kopia av repot med egen branch.

```
equinet/                          <- huvudrepo (Johan + tech lead)
../equinet-s24-1/                 <- worktree session A (webb-story)
../equinet-s24-2/                 <- worktree session B (iOS-story)
```

**Max 2 parallella sessioner.** Mer ökar merge-komplexiteten utan proportionell vinst.

---

## Före start -- checklista

Innan du startar parallella sessioner, verifiera:

- [ ] **Main är rent:** `git status` visar inga ocommittade ändringar
- [ ] **Main är uppdaterat:** `git pull origin main`
- [ ] **Stories identifierade:** Två specifika story-IDs valda
- [ ] **Domänkoll:** Kolla `.claude/rules/code-map.md` -- rör stories HELT separata domäner?
- [ ] **Ingen schema-ändring:** Ingen av stories ändrar `prisma/schema.prisma`
- [ ] **Status.md uppdaterat:** Båda stories markerade `in_progress` med respektive branch

---

## Starta parallella sessioner

### Steg 1: Skapa worktrees från main

```bash
# I huvudrepot (equinet/)
git worktree add ../equinet-s24-1 -b feature/s24-1-namn main
git worktree add ../equinet-s24-2 -b feature/s24-2-namn main
```

### Steg 2: Starta sessioner i separata terminaler

**Terminal 1:**
```bash
cd ../equinet-s24-1
claude
# I Claude: "kör S24-1"
```

**Terminal 2:**
```bash
cd ../equinet-s24-2
claude
# I Claude: "kör S24-2"
```

### Steg 3: Uppdatera status.md (i huvudrepot)

```markdown
| Session A | fullstack | S24-1 | feature/s24-1-namn | 2026-04-12 |
| Session B | fullstack | S24-2 | feature/s24-2-namn | 2026-04-12 |
```

**VIKTIGT:** Uppdatera status.md BARA från huvudrepot, aldrig från worktrees.

---

## Under körning -- regler

### Varje session:
- Arbetar BARA i sin worktree-katalog
- Committar BARA till sin feature branch
- Kör `npm run check:all` i sin worktree
- Rör ALDRIG filer utanför sin domän (se Domängränser)

### Delade filer -- VEM FÅR RÖRA VAD:

| Fil | Session A | Session B | Varför |
|-----|-----------|-----------|--------|
| `prisma/schema.prisma` | ALDRIG | ALDRIG | Schema-ändringar måste vara sekventiella |
| `docs/sprints/status.md` | ALDRIG | ALDRIG | Uppdateras från huvudrepot av Johan/tech lead |
| `CLAUDE.md` | ALDRIG | ALDRIG | Uppdateras efter merge av docs-session |
| `package.json` | ALDRIG | ALDRIG | Dependency-ändringar påverkar båda |
| `.claude/rules/*` | ALDRIG | ALDRIG | Ändrar beteendet för den andra sessionen |
| `src/domain/<sin-domän>/*` | JA | NEJ | Domänexklusivitet |
| `src/domain/<sin-domän>/*` | NEJ | JA | Domänexklusivitet |
| `src/lib/*` (utilities) | FÖRSIKTIGT | FÖRSIKTIGT | Delade filer -- bara om nödvändigt, aldrig samma fil |

### Om en session behöver ändra en delad fil:
1. STOPPA
2. Dokumentera behovet i done-filen
3. Gör ändringen EFTER merge, i huvudrepot

---

## Merge-protokoll

Merge sker ALLTID sekventiellt, en i taget, från huvudrepot.

### Den som blir klar först:

```bash
# I huvudrepot (equinet/)
cd ~/Development/equinet

# 1. Hämta senaste main
git pull origin main

# 2. Merga session A
git merge feature/s24-1-namn --no-ff -m "Merge feature/s24-1: beskrivning"

# 3. Pusha
git push origin main

# 4. Rensa worktree
git worktree remove ../equinet-s24-1
git branch -d feature/s24-1-namn
```

### Den som blir klar sist:

```bash
# I huvudrepot (equinet/)
cd ~/Development/equinet

# 1. KRITISKT: hämta main (som nu inkluderar session A)
git pull origin main

# 2. Merga session B
git merge feature/s24-2-namn --no-ff -m "Merge feature/s24-2: beskrivning"

# 3. Om merge-konflikt: LÖS I HUVUDREPOT, aldrig i worktree
# 4. Pusha
git push origin main

# 5. Rensa worktree
git worktree remove ../equinet-s24-2
git branch -d feature/s24-2-namn
```

**VIKTIGT:** `git pull origin main` FÖRE varje merge. Annars riskerar du divergent branches.

---

## Domängränser

Använd `.claude/rules/code-map.md` för att identifiera vilka filer som hör till vilken domän. Här är de vanligaste parallelliseringarna:

### Webb + iOS (bevisat säkert)

| Session A (webb) | Session B (iOS) |
|-------------------|-----------------|
| `src/domain/*` | `ios/Equinet/*` |
| `src/app/api/*` | `ios/Equinet/EquinetWidget/*` |
| `src/app/provider/*` | |
| `src/components/*` | |
| `e2e/*` | |

Enda överlapp: `src/app/api/native/*` routes. Om iOS-storyn ändrar native API:er, KÖR INTE parallellt med en webb-story som rör samma routes.

### Två webb-domäner (möjligt med försiktighet)

| Session A (booking) | Session B (review) |
|---------------------|-------------------|
| `src/domain/booking/*` | `src/domain/review/*` |
| `src/infrastructure/persistence/booking/*` | `src/infrastructure/persistence/review/*` |
| `src/app/api/bookings/*` | `src/app/api/reviews/*` |
| `src/app/provider/bookings/*` | `src/app/provider/reviews/*` |

**Krav:** Domänerna får INTE dela repositories, services eller routes.

### Docs + implementation (alltid säkert)

| Session A (implementation) | Session B (docs) |
|---------------------------|-----------------|
| `src/*` | `docs/*` |
| `e2e/*` | `.claude/rules/*` |
| | `CLAUDE.md` (bara docs-sessionen) |

---

## Vad som ALDRIG får köras parallellt

| Kombination | Varför |
|-------------|--------|
| Två stories som ändrar `prisma/schema.prisma` | Migration-ordning är kritisk |
| Två stories som rör samma domän | Merge-konflikter i service/repository |
| Två stories som båda ändrar `package.json` | Dependency-konflikter |
| Två stories som båda rör auth (`src/lib/auth-*`) | Säkerhetskritiskt, kräver sekventiell review |
| En story som ändrar `src/lib/*` utilities + en som konsumerar dem | Race condition på interface-ändringar |

### Snabbtest: "Kan dessa köras parallellt?"

1. Lista filerna varje story troligen rör (läs planen)
2. Kolla code-map.md -- finns överlapp i domän, routes eller components?
3. Rör någon `prisma/schema.prisma`, `package.json`, `src/lib/*`?
4. Om JA på 2 eller 3: KÖR SEKVENTIELLT

---

## Felsökning

### Merge-konflikt vid andra merge

```bash
# I huvudrepot efter git merge som ger konflikt:
git diff                    # Se vad som krockar
# Lös konflikten manuellt
git add <lösta filer>
git commit                  # Slutför merge
npm run check:all           # Verifiera att allt fungerar
```

### Session behöver en fil från den andra sessionen

STOPPA sessionen. Vänta tills den andra sessionen är mergad. Fortsätt sedan med `git pull origin main` i worktreen:

```bash
cd ../equinet-s24-2
git merge main              # Hämta den andra sessionens ändringar
# Fortsätt arbetet
```

### Worktree har blivit stale

```bash
cd ../equinet-s24-1
git status                  # Kolla vad som hänt
git merge main              # Uppdatera mot main
npm install                 # Om package.json ändrats på main
```

### Rensa efter krasch/avbrott

```bash
# Lista alla worktrees
git worktree list

# Ta bort en specifik worktree
git worktree remove ../equinet-s24-1 --force

# Rensa branch
git branch -D feature/s24-1-namn
```
