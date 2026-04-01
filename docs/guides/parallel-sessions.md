---
title: "Parallella sessioner -- guide"
description: "Hur flera Claude-sessioner kan jobba parallellt utan konflikter"
category: guide
status: draft
last_updated: 2026-04-01
tags: [workflow, team, parallel, worktree]
sections:
  - Varför det krånglade
  - Approach 1 Filbaserad uppdelning
  - Approach 2 Git worktrees
  - Regler
  - Exempel
  - Checklista innan parallellkörning
---

# Parallella sessioner -- guide

## Varför det krånglade (sprint 3)

Två sessioner på samma working directory:
- Branch-krockar (bara en branch kan vara utkeckad)
- Ocommittade filer från en session bröt tester för en annan
- Lead committade till Devs branch av misstag

**Rotorsak:** Ingen uppdelning av vilka filer varje session fick röra.

---

## Approach 1: Filbaserad uppdelning (samma branch, samma mapp)

Enklast. Fungerar om stories har tydliga filgränser.

**Princip:** Varje session äger en uppsättning filer. Ingen annan session rör dem.

**Hur:**
1. Sprint-storyn listar exakt vilka filer/mappar sessionen får ändra
2. status.md visar fillåsning per session
3. Sessioner committar ofta (var 15 min) så andras ändringar syns via `git pull`

**Exempel status.md:**
```
| Session | Story | Filer (låsta) |
|---------|-------|--------------|
| Dev-1 | S8-1 Payment polish | src/domain/payment/*, src/app/api/**/payment/** |
| Dev-2 | S8-2 iOS native | ios/**, src/app/api/native/** |
| Lead | Review | docs/**, .claude/** |
```

**Begränsningar:**
- Fungerar INTE om två stories rör samma fil
- Kräver noggrann planering vid story-skapande
- Merge-konflikter kan uppstå i delade filer (package.json, status.md)

---

## Approach 2: Git worktrees (separat mapp per session)

Varje session får en isolerad kopia av repot.

**Setup:**
```bash
# Skapa worktree för Dev-session
git worktree add ../equinet-dev feature/story-namn

# Dev jobbar i ../equinet-dev/
# Lead jobbar i ../equinet/ (huvudrepo)

# När klar: pusha branch, ta bort worktree
git worktree remove ../equinet-dev
```

**Fördelar:**
- Helt isolerat -- inga filkonflikter alls
- Varje session har sin egen branch
- Fungerar även om stories rör samma filer (merge vid review)

**Nackdelar:**
- Diskutrymme (full kopia av working directory, ~500MB)
- `node_modules` måste installeras per worktree (eller symlänkas)
- Dev-server måste köras på olika portar
- Lite mer setup-arbete

---

## Regler för parallellt arbete

1. **Definiera filgränser INNAN sessionerna startar.** Skriv det i status.md.
2. **Committa ofta.** Var 15 min minimum. Förhindrar att ändringar ackumuleras.
3. **Pull ofta.** `git pull --rebase` vid sessionstart och efter varje commit.
4. **Lead rör aldrig kod medan Dev jobbar.** Lead gör bara docs-commits.
5. **Delade filer (package.json, status.md) committas av EN session åt gången.**
6. **Vid konflikt: den som upptäcker den löser den.** Inte den andra sessionen.

---

## Exempel: Sprint med 2 parallella sessioner

### Planering (Lead)

```
Story A: Stripe polish (src/domain/payment/*, src/components/customer/bookings/*)
Story B: iOS due-for-service polish (ios/**, src/app/api/native/due-for-service/*)
```

Filerna överlappar INTE. Kan köras parallellt.

### Körning

```
Terminal 1: "kör" -> plockar Story A -> jobbar i payment-filer
Terminal 2: "kör" -> plockar Story B -> jobbar i iOS-filer
Lead: väntar, granskar planer, reviewar när de pushar
```

### Merge (Lead)

```
"kör review" -> granska Story A -> merga
"kör review" -> granska Story B -> merga
```

### INTE parallelliserbart

```
Story C: withApiHandler-migrering (rör 20+ route-filer)
Story D: Auth-förbättringar (rör samma route-filer)
```

Filerna överlappar. Kör sekventiellt.

---

## Checklista innan parallellkörning

- [ ] Stories har INGA överlappande filer
- [ ] Filgränser dokumenterade i status.md
- [ ] Worktrees skapade (om approach 2)
- [ ] Varje session vet sin fillåsning
- [ ] Lead committar INTE kod under parallella sessioner
- [ ] Delade filer (package.json, status.md) har en ägare
