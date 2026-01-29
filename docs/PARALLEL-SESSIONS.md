# Parallella Claude Code-sessioner med Git Worktrees

Guide för att köra flera Claude Code-instanser samtidigt på samma projekt.

## Varför Worktrees?

**Problemet med vanliga branches:**
- Claude Code låser filer när den arbetar
- Två sessioner på samma mapp = filkonflikter och korrupt state
- `git checkout` mitt i en session förstör pågående arbete

**Worktrees löser detta:**
- Varje worktree är en **separat mapp** med egen working directory
- Delar samma `.git`-databas (commits, branches, history)
- Helt isolerade filsystem = inga konflikter

## Steg-för-steg Setup

### 1. Skapa worktree för ny feature

```bash
# Från huvudmappen (t.ex. ~/Development/equinet)
git worktree add ../equinet-feature-x feature/feature-x

# Eller skapa ny branch direkt
git worktree add -b feature/new-thing ../equinet-new-thing main
```

### 2. Öppna ny terminal och starta Claude

```bash
cd ../equinet-feature-x
claude
```

### 3. Arbeta parallellt

Nu kan du ha:
- **Terminal 1**: `~/Development/equinet` (main branch)
- **Terminal 2**: `~/Development/equinet-feature-x` (feature branch)

Varje terminal har sin egen Claude-session som arbetar oberoende.

## Praktiska Exempel

### Scenario: Bugfix medan feature pågår

```bash
# Session 1 arbetar på feature/booking-calendar
# Du upptäcker en kritisk bugg som måste fixas NU

# I ny terminal:
git worktree add ../equinet-hotfix hotfix/critical-bug
cd ../equinet-hotfix
claude
# Fixa buggen, pusha, mergea till main
```

### Scenario: Parallell utveckling

```bash
# Skapa worktrees för olika features
git worktree add ../equinet-auth feature/auth-improvements
git worktree add ../equinet-ui feature/ui-refresh

# Starta Claude i varje (separata terminaler)
cd ../equinet-auth && claude
cd ../equinet-ui && claude
```

## Städa Upp

### Lista aktiva worktrees

```bash
git worktree list
```

### Ta bort worktree efter merge

```bash
# Ta bort worktree (mappen försvinner)
git worktree remove ../equinet-feature-x

# Om mappen redan är borttagen manuellt
git worktree prune
```

### Ta bort branch efter merge

```bash
git branch -d feature/feature-x
```

## Tips och Best Practices

### Namnkonvention för mappar

Använd konsekvent namngivning:
- `equinet-{branch-suffix}` - t.ex. `equinet-auth`, `equinet-hotfix`
- Eller `equinet-{session-purpose}` - t.ex. `equinet-bugfix`, `equinet-experiment`

### Var försiktig med delade resurser

- **Databas**: Om båda sessions kör mot samma databas kan data krocka
- **Portar**: Kör dev-servers på olika portar (`PORT=3001 npm run dev`)
- **.env-filer**: Kopieras med worktree - uppdatera om nödvändigt

### Synka ändringar mellan worktrees

```bash
# I worktree: hämta senaste från main
git fetch origin
git rebase origin/main
```

### Commit ofta

Worktrees delar git-historiken. Committa ofta så att ändringar är tillgängliga för andra worktrees via `git fetch`.

## Begränsningar

- Kan inte ha samma branch utkollad i flera worktrees
- Disk space: varje worktree tar plats (dock inte `.git`)
- `node_modules` måste installeras separat i varje worktree

## Snabbreferens

| Kommando | Beskrivning |
|----------|-------------|
| `git worktree add <path> <branch>` | Skapa worktree för befintlig branch |
| `git worktree add -b <new-branch> <path> <start-point>` | Skapa worktree med ny branch |
| `git worktree list` | Lista alla worktrees |
| `git worktree remove <path>` | Ta bort worktree |
| `git worktree prune` | Städa upp döda worktree-referenser |
