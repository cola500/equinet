---
title: "Handoff: Production Deploy Gate"
description: "Historisk handoff (2026-09-16) om produktions-deploy-gaten, blockerad på VERCEL_TOKEN-scope. Obsolet 2026-10-01: ersatt av manuellt SHA-pinnat deploy-production.yml"
category: plan
tags: [handoff, ci-cd, vercel, deployment, security, obsolete]
status: archived
last_updated: 2026-10-01
related:
  - docs/operations/vercel-token-sync-and-production-deploy.md
sections:
  - Obsolet
  - Status
  - Bakgrund -- varför denna ändring
  - Vad som är klart
  - Blockerare -- kräver din input
  - Nästa steg när token är löst
  - Verifieringschecklista (återstår)
  - Nyckel-referenser
  - Sidofynd under vägen (inte åtgärdade, separat spår)
---

# Handoff: Production Deploy Gate

## Obsolet

**Markerad obsolet 2026-10-01.** Resten av dokumentet är en historisk ögonblicksbild från 2026-09-16 av hur produktions-deploy-gaten utreddes och stoppades på `VERCEL_TOKEN`-scope. Statusen och "nästa steg" nedan gäller inte längre och ska inte följas.

**Vad som hänt sedan (kontrollerat mot repo och GitHub 2026-10-01):**

- **Designen är ersatt.** Jobbet `deploy-production` i `quality-gates.yml` (PR #490) finns inte kvar. Sedan 2026-09-28 sköts produktionsdeploy av `.github/workflows/deploy-production.yml`: enbart `workflow_dispatch`, obligatoriskt `sha`-input (plus `staging_verified_sha` som operatörens attestering), ett `validate`-jobb som kräver grön `Quality Gate Passed` för exakt den SHA:n, och ett `deploy`-jobb under GitHub-environmentet `production` med `dry_run` som standard. `vercel.json` har fortfarande `git.deploymentEnabled.main: false`.
- **Blockeraren är löst.** `VERCEL_TOKEN` uppdaterades 2026-09-29 14:36 UTC. Körningar av `deploy-production.yml`: 2026-09-28 fyra misslyckade och två lyckade; 2026-09-29 en misslyckad (14:27) följd av två lyckade (14:36 och 14:40).
- **Sidofynd 1 och 2 är lösta.** `allow_auto_merge` är `true` på repot, och PR #486, #465, #463 och #474 är alla mergade.
- **Sidofynd 3 och 4 är inte omkontrollerade.** Det okända `staging`-schemat och de tre Supabase Security Advisor-fynden verifierades inte mot databaserna idag. Schemat förs som öppen fråga i `docs/operations/environments.md`, och Advisor-fynden som ej åtgärdade i `docs/sprints/backlog.md` (uppdaterad 2026-09-27).
- **Inte verifierat:** att `equinet-app`s Production Branch i Vercel-dashboarden fortfarande är `main` (kan inte läsas från repot).

Aktuell dokumentation: `.github/workflows/deploy-production.yml` och [vercel-token-sync-and-production-deploy.md](../operations/vercel-token-sync-and-production-deploy.md). Den senare beskriver i sin "Bakgrund" fortfarande det gamla jobbet i `quality-gates.yml` och bör uppdateras separat.

## Status

**Blockerad, inte trasig.** Gaten fungerar mekaniskt exakt som avsett -- den stoppade en deployment som inte kunde autentisera, istället för att släppa igenom något overifierat. Produktion är opåverkad och kör på senaste kända goda deployment. Det som saknas är en korrekt scopad `VERCEL_TOKEN`.

## Bakgrund -- varför denna ändring

En CI/CD-genomlysning visade att Vercels git-integration deployade till production direkt på push/merge till `main`, **oberoende av** om `quality-gates.yml` hunnit klart eller ens lyckats. Verifierat: produktionsdeploymenten för både PR #488 och #489s merge-commits startade byggnad ~3.6–4.5 sekunder efter push, medan `quality-gates.yml` tar ~5-6 minuter. Ingen branch protection fanns heller på `main` (`gh api repos/cola500/equinet/branches/main/protection` → 404).

Målbild:
```
main → GitHub CI → quality-gate-passed → deploy-production (GitHub Actions) → Vercel production
```
Preview-deployments för feature branches/PR:er ska vara oförändrade.

## Vad som är klart

**PR #490 mergad till main** (commit `c260fb01`), två filändringar:

1. **`vercel.json`** -- `git.deploymentEnabled.main: false`. Stänger av Vercels automatiska deploy helt för `main` (källa: Vercels officiella dokumentation, `git.deploymentEnabled`, "Unspecified branches default to true" -- preview för andra branches opåverkat).
2. **`.github/workflows/quality-gates.yml`** -- nytt jobb `deploy-production`, `needs: quality-gate-passed`, `if: github.ref == 'refs/heads/main' && needs.quality-gate-passed.result == 'success'`. Kör `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.

**Repo-secrets satta:**
- `VERCEL_ORG_ID` = `team_j5goSqV46IZBWc3kfbUfqwas`
- `VERCEL_PROJECT_ID` = `prj_HKujmIYaLJopCS3VjJGDckM8riFB`
- `VERCEL_TOKEN` = satt, men **fungerar inte** (se Blockerare)

**Verifierat i den första riktiga körningen** (workflow run `34958571933`, commit `c260fb01`):

| Kriterium | Resultat | Evidens |
|---|---|---|
| Ingen separat auto-deploy från Vercels git-integration | ✅ | `list_deployments` visade 0 nya deployments i 6+ minuter kring mergen |
| `deploy-production` startar först efter grön `quality-gate-passed` | ✅ | `Quality Gate Passed` klar 10:39:21 → `Deploy to Production` startade 10:39:29 (8s) |
| Preview-deployments fungerar fortfarande | ✅ | Bekräftat under PR #490:s egen CI-körning (`Vercel – equinet-app: pass`, fungerande preview-URL) |
| Produktion opåverkad av det misslyckade jobbet | ✅ | `equinet.johanlindengard.com` pekar fortfarande på `dpl_EJYAHxtTqf1oVJa3EpeYhzsLJoeq` (från PR #489), `state: READY` |

## Blockerare -- kräver din input

`deploy-production` failade efter 24 sekunder, i steget `vercel pull`:

```
Error: Could not retrieve Project Settings. To link your Project, remove the `.vercel` directory and deploy again.
```

Token+org+project-kombinationen resolvar inte. Mest sannolik orsak: token skapades utan koppling till rätt scope (team **"cola500's projects"** / projekt **equinet-app**) -- t.ex. skapad på personligt konto-scope istället för team-scope.

**Innan nästa försök, bekräfta:**
1. Vilket scope/team var aktivt när `VERCEL_TOKEN` skapades?
2. Rekommenderad fix: skapa om via CLI, explicit projekt-scopad (säkrast, minsta behörighet):
   ```bash
   vercel tokens add "GitHub Actions - equinet-app" --project prj_HKujmIYaLJopCS3VjJGDckM8riFB
   ```
   Kräver att `vercel login` lokalt är inloggad mot rätt konto/team först (`vercel switch cola500s-projects` om osäker).
3. Uppdatera secreten: `gh secret set VERCEL_TOKEN` (kör själv, inte via chatten -- token ska aldrig passera konversationen).

## Nästa steg när token är löst

1. Trigga en ny körning mot `main` (t.ex. en tom/trivial commit, eller vänta på nästa riktiga ändring) -- **inte** manuell `workflow_dispatch`, vi vill se det riktiga flödet.
2. Bevaka `deploy-production` till klart.
3. Kör resten av verifieringschecklistan nedan.

## Verifieringschecklista (återstår)

- [ ] Exakt en ny production-deployment skapas (inte fler, inte noll)
- [ ] `equinet.johanlindengard.com` pekar på den nya deploymenten (`get_deployment` med domänen som `idOrUrl`)
- [ ] Appen svarar korrekt efter deploy (verifiera via `get_deployment`-status, inte bara rå `curl` -- en direkt `curl` mot domänen gav tidigare `HTTP 429`, sannolikt bot-/rate-limit-skydd, inte ett appfel)
- [ ] Bekräfta i Vercel-dashboarden att `equinet-app`s Production Branch fortfarande är satt till `main` (aldrig ändrad av oss, bara sanity-check)

## Nyckel-referenser

- PR: [#490](https://github.com/cola500/equinet/pull/490) (mergad)
- Merge-commit: `c260fb01f7ef259a5f84fa40c60cd3c82b478442`
- Workflow-körning: `34958571933`, jobb `Deploy to Production` (failed run)
- Vercel-projekt (produktion): `prj_HKujmIYaLJopCS3VjJGDckM8riFB` (`equinet-app`)
- Vercel-team: `team_j5goSqV46IZBWc3kfbUfqwas` (`cola500s-projects`)
- Senaste kända goda production-deployment: `dpl_EJYAHxtTqf1oVJa3EpeYhzsLJoeq`
- Bakomliggande discovery-sessioner (samma dag, före denna handoff): CI/CD-genomlysning av GitHub Actions + Vercel-integrationen, samt en tidigare RLS-CI-guardrail-slice (PR #489) och en säkerhetsfix-slice (PR #488) -- alla mergade och gröna innan detta arbete påbörjades.

## Sidofynd under vägen (inte åtgärdade, separat spår)

- **`allow_auto_merge: false` på repo-nivå** (`gh api repos/cola500/equinet`) -- förklarar varför tre annars gröna dependabot-patch-PR:er (#486, #465, #463) har stått olösta i 8–43 dagar; `dependabot-auto-merge.yml`s `gh pr merge --auto` failar tyst med `GraphQL: Auto merge is not allowed for this repository`. Fix: aktivera "Allow auto-merge" i repo-settings.
- **PR #474** (`feature/gdpr-compliance-documentation`, 37 dagar gammal) har genuint trasig CI (Lint + Quality Gate Passed failar), inte bara auto-merge-problemet.
- **Okänt `staging`-schema** i det delade Supabase-staging-projektet (`zzdamokfeenencuggjjp`) -- en fullständig parallell kopia av hela Equinet-schemat (43 tabeller), varav 22 saknar RLS. Inte samma sak som den faktiska staging-miljön (som ligger i `public`-schemat och är fullt RLS-täckt). Redan dokumenterat som öppen fråga i `docs/operations/environments.md`.
- **Tre Supabase Security Advisor WARN-fynd** (mutable search_path på två funktioner, publikt anropbar `handle_new_user()` SECURITY DEFINER-funktion, leaked-password-protection avstängt) -- redan noterade som separat read-only-uppföljning i `docs/sprints/backlog.md`, inte åtgärdade.
