---
title: "S9-1: Branch protection + Dependabot"
description: "Plan for att sakra main-branchen med GitHub branch protection rules och Dependabot"
category: plan
status: active
last_updated: 2026-04-02
sections:
  - Bakgrund
  - Scope
  - Filer som andras eller skapas
  - Implementation
  - Merge-flodet fore och efter
  - Risker
  - Verifiering
  - Acceptanskriterier
---

# S9-1: Branch protection + Dependabot

## Bakgrund

Tech-architect-review identifierade att direkta commits till main med Stripe
live-mode ar oacceptabelt. Idag kan vem som helst (`git push origin main`)
pusha direkt. Pre-push hook kor kvalitetsgates lokalt, men det gar att
kringga med `--no-verify`. Branch protection pa GitHub-niva ar det enda
sakra skyddet.

Dessutom saknas Dependabot -- sakerhetsuppdateringar for npm-paket och
GitHub Actions maste bevakas manuellt idag.

## Scope

**Bara DevOps/docs-filer.** Ingen src/**, ingen ios/**.

Storyn foljer forenklat stationsflode: Green -> Verify -> Merge.
Inga tester kravs (ren konfiguration).

## Filer som andras eller skapas

| Fil | Aktion | Beskrivning |
|-----|--------|-------------|
| `.github/dependabot.yml` | **Ny** | Dependabot-konfiguration (npm + actions) |
| `AGENTS.md` | **Andras** | Ny tech-architect-roll + uppdaterat merge-flode |
| `.claude/rules/tech-lead.md` | **Andras** | Station 7 byter fran `git merge` till `gh pr create` |
| `docs/plans/s9-1-plan.md` | **Ny** | Denna plan |

## Implementation

### Steg 1: GitHub branch protection (manuellt av Johan)

Branch protection maste konfigureras via GitHub UI eller `gh api`.
Det ar INTE en fil i repot -- det ar en GitHub-installning.

**Rekommenderade regler for `main`:**

```
Branch name pattern: main
- [x] Require a pull request before merging
  - Required approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - Required checks: "Quality Gate Passed" (fran quality-gates.yml)
- [x] Do not allow bypassing the above settings
- [ ] Require signed commits (ej nu -- lagg till senare)
- [x] Block force pushes
- [x] Restrict deletions
```

**Varfor "Quality Gate Passed":** Workflowen `quality-gates.yml` har redan
ett aggregerings-jobb (`quality-gate-passed`) som kraver att unit-tests,
e2e, typecheck, build, lint och security-audit alla passerar. Genom att
krava just detta jobb som status check far vi en enda gate att peka pa.

**CLI-alternativ (om Johan foredrar):**

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Quality Gate Passed"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

### Steg 2: Dependabot-konfiguration (fil i repot)

Skapa `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    groups:
      # Batcha mindre uppdateringar
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
    # Sakerhetsfixar oavsett schedule
    # (Dependabot skapar security PRs automatiskt)

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "ci"
```

### Steg 3: Uppdatera AGENTS.md

1. Lagg till **Tech-architect**-rollen under Roller-sektionen
2. Uppdatera station 7 (MERGE) i stationsflodets beskrivning

### Steg 4: Uppdatera tech-lead.md

Byt station 7 fran:
```
git checkout main && git merge feature/<branch> --no-ff
git push origin main
```

Till:
```
gh pr create --base main --head feature/<branch> --title "..." --body "..."
# Vanta pa CI (Quality Gate Passed)
gh pr merge <PR-nummer> --merge --delete-branch
```

## Merge-flodet fore och efter

### FORE (nuvarande)

```
Dev pushar feature branch -> Tech lead kor check:all lokalt ->
  git checkout main -> git merge feature/X --no-ff -> git push origin main
```

**Problem:**
- Ingen CI-verifiering pa PR-niva (bara lokala gates)
- Force push till main mojlig
- `--no-verify` kringgara pre-push hook
- Ingen approvalspårning

### EFTER (med branch protection)

```
Dev pushar feature branch ->
  Tech lead: gh pr create --base main --head feature/X ->
  CI kor quality-gates.yml automatiskt ->
  "Quality Gate Passed" krävs for merge ->
  Tech lead: gh pr merge <nr> --merge --delete-branch ->
  GitHub mergar (--no-ff implicit vid merge commit)
```

**Forbattringar:**
- CI MASTE passera innan merge (kan inte kringggas)
- PRs ger historik, kommentarer, review trail
- Force push blockerad pa GitHub-niva
- Dependabot skapar PRs automatiskt for sakerhetsuppdateringar

### Paverkan pa lokalt arbete

- `git push -u origin feature/X` -- **oforandrat** (feature branches paverkas inte)
- `git push origin main` -- **blockerat** (kraver PR)
- Pre-push hook -- **fortfarande aktiv** (fangar problem lokalt fore push)
- `check:all` -- **fortfarande relevant** (kor lokalt innan push for snabb feedback)

### AGENTS.md-andringar

Station 7 i stationsflodets beskrivning andras fran:
```
7. MERGE   -- Tech lead granskar och mergar till main.
```
Till:
```
7. MERGE   -- Tech lead skapar PR, CI passerar, mergar via GitHub.
```

## Risker

| Risk | Sannolikhet | Konsekvens | Atgard |
|------|-------------|-----------|--------|
| Johan maste vara approver | Hog | Blockerar merge | Satt Johan + Claude-bot som approvers, eller sank till 0 required approvals och anvand bara CI-gate |
| CI flaky -> blockerar merge | Lag | Forsening | security-audit ar redan `continue-on-error`, ovriga ar stabila |
| Dependabot-storm (manga PRs) | Medel | Brus | Gruppering (minor+patch batched), limit 10 PRs |

**Approver-fragan:** GitHub branch protection kraver att en *GitHub-anvandare*
godkanner PRn. Claude-sessioner kan inte godkanna PRs pa GitHub.
Rekommendation: satt `required_approving_review_count: 0` och lat
"Require status checks" vara den faktiska gaten. Tech lead
dokumenterar sin granskning i PR-kommentarer, men godkannandet
ar CI-drivet. Johan kan hoja till 1 approval nar han vill granska
PRs sjalv.

## Verifiering

Eftersom detta ar konfiguration, inte kod, verifieras det sa har:

1. [ ] `.github/dependabot.yml` -- yamllint eller `cat` (korrekt syntax)
2. [ ] AGENTS.md -- las igenom, kontrollera att merge-flodet ar uppdaterat
3. [ ] tech-lead.md -- las igenom, kontrollera station 7
4. [ ] **Efter merge:** skapa en test-PR fran en throw-away branch och verifiera att CI kors och "Quality Gate Passed" krävs

## Acceptanskriterier (fran sprint-dokumentet)

- [ ] Direkta commits till main blockerade av GitHub
  - **Hur:** Branch protection rule (steg 1, manuellt av Johan)
- [ ] Dependabot skapar PRs for sakerhetsuppdateringar
  - **Hur:** `.github/dependabot.yml` (steg 2)
- [ ] Workflow uppdaterat (Lead skapar PR istallet for `git push`)
  - **Hur:** AGENTS.md + tech-lead.md (steg 3-4)
