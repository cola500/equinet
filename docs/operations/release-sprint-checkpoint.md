---
title: "Release-Ready Sprint -- Checkpoint"
description: "Löpande status, paus-/återupptagningsprotokoll och rollbackplan för sprinten som tar main från stabil baseline till en verifierad releasekandidat"
category: operations
status: active
last_updated: 2026-09-29
tags: [release, deployment, vercel, staging, checkpoint, rollback]
related:
  - docs/operations/vercel-token-sync-and-production-deploy.md
  - docs/operations/staging-environment-setup.md
  - docs/operations/dependabot.md
sections:
  - Syfte
  - Slutförda slices
  - Mergade PR:ar och commits
  - Nuläge (SHA:er)
  - Verifierat, utan hemligheter
  - Inte gjort
  - Kända blockerare och återstående slices
  - Paus- och återupptagningsprotokoll
  - Rollbackplan för stagingsteget
  - Rollbackplan för produktion (inför en framtida, separat godkänd produktionsdeploy)
  - "Tydlig paus- och återupptagningspunkt: FÖRE produktion"
---

# Release-Ready Sprint -- Checkpoint

## Syfte

Detta dokument är den enda källan till sanning för var release-ready-sprinten står, för en människa eller en ny agent-session som behöver återuppta arbetet utan att gissa. Uppdateras vid varje betydande checkpoint. Ersätter INTE sprintplanen (publicerad som Artifact, "Release-Ready Sprint") -- den beskriver *vad* som ska göras och i vilken ordning; detta dokument beskriver *var vi faktiskt står just nu*.

**Ingen hemlig information finns eller ska någonsin läggas till i detta dokument** -- inga tokenvärden, inga secret-namn utöver vad som redan är offentligt dokumenterat i `docs/operations/vercel-token-sync-and-production-deploy.md`, inga databas-URL:er eller uppkopplingssträngar.

## Slutförda slices

| Slice | Beskrivning | Status |
|-------|-------------|--------|
| 2.2 (reviderad) | Produktionsdeploy omgjord till `workflow_dispatch`-only, obligatorisk `sha`-input, ingen required-reviewer (Johans uttryckliga dispatch-kommando är godkännandepunkten) | ✅ Klar |
| 2.4 | Negativa triggerkontroller: push, tagg, Dependabot-merge, release-event | ✅ Klar, verifierade |
| Förutsättning för 2.3 | `dry_run` kör nu `vercel pull` + `vercel build` på riktigt (muterar inget) så att en tokenrotation kan verifieras utan riktig deploy | ✅ Klar |
| 2.3 | `VERCEL_TOKEN`-rotation | ✅ Klar, verifierad (se nedan) |
| 3.1 | Force-push av fryst releasekandidat-SHA till `preview/candidate` | ✅ Klar, verifierad (se nedan) |
| 3.2 | Manuell rök-verifiering av releasekandidaten mot Preview-deploymenten `dpl_6VHpb2b3bUzBzYoHcgxJN1oYyYhd` (Playwright, demo-läge, auth, bokning end-to-end + städning av testdata i delad staging-databas) | ✅ Klar, verifierad (se nedan) |
| 3.3 | Promotion av releasekandidaten till `equinet-staging-app`s levande produktionsalias (`equinet-staging.johanlindengard.com`) | ✅ Klar, verifierad (se nedan) |
| 5/6 | Release notes förberedda + GitHub Release-utkast (draft) skapat för v0.3.0, mål-SHA `4973f6e919339b022425063bd8a280fa2bbe9b41` | ✅ Klar, verifierad (se nedan) |

## Mergade PR:ar och commits

| PR | Titel | Merge-commit på `main` |
|----|-------|------------------------|
| [#511](https://github.com/cola500/equinet/pull/511) | ci(deploy): produktionsdeploy blir workflow_dispatch-only, kräver explicit SHA | `ae2389517d10e03fef01927e5866ab1a13bbce4b` |
| [#512](https://github.com/cola500/equinet/pull/512) | ci(deploy): låt dry_run köra Pull+Build på riktigt för att verifiera VERCEL_TOKEN | `527c2e80f3311dc76a7b26d121918a113a1e6390` |

Dessförinnan, samma dag, i samma sprint-kontext (dependabot-auto-merge-säkring och PR-städning som ledde fram till denna release-sprint): PR #509, #510, #486, #463, #465, #505, #504 (stängd som överspelad), #474 -- se `docs/operations/dependabot.md` och `docs/operations/staging-environment-setup.md` för respektive sakinnehåll.

## Nuläge (SHA:er)

Senast verifierat 2026-09-29 (oberoende slutkontroll, se "Rättelse av release notes + slutkontroll" nedan).

| Vad | SHA | Deployment-ID | Källa |
|-----|-----|----------------|-------|
| **Fryst releasekandidat (enda giltiga)** | **`4973f6e919339b022425063bd8a280fa2bbe9b41`** | -- | `main`-HEAD direkt efter att checkpoint-PR #513 mergades. Grön `Quality Gate Passed` bekräftad för exakt denna SHA (körning `36435973623`, samtliga 8 jobb + aggregatorn `success`) |
| **Staging -- NUVARANDE LIVE deployment** (`equinet-staging-app`, target=production, `equinet-staging.johanlindengard.com`) | **`4973f6e919339b022425063bd8a280fa2bbe9b41`** (= releasekandidaten) | `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL` | Vercel `list_deployment_aliases` + `get_deployment`, verifierad efter Slice 3.3-promotion och igen vid slutkontrollen 2026-09-29 |
| **Staging -- ROLLBACK-MÅL** (samma projekt, INTE live just nu) | `4284202221f07216269659873cacf1f9b9f64f04` (PR #503) | `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8` | Föregående live-deployment innan Slice 3.3 -- finns kvar, inspekterbar, orörd. Se "Rollbackplan för stagingsteget" |
| **Produktion -- NUVARANDE LIVE deployment** (`equinet-app`, target=production) | `4284202221f07216269659873cacf1f9b9f64f04` (PR #503) | `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa` | Vercel `list_deployments` -- **bekräftat oförändrad, verifierad flera gånger, senast vid slutkontrollen 2026-09-29** |
| **Produktion -- ROLLBACK-MÅL vid en framtida deploy** | Samma som ovan (produktionen har ännu inte deployats om) | Samma som ovan, `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa` | Produktionen är just nu sitt eget rollback-mål -- blir relevant först när/om en framtida produktionsdeploy sker. Se "Rollbackplan för produktion" |

**Viktigt att inte blanda ihop:** stagings "nuvarande live deployment" och "rollback-mål" är två OLIKA deployment-ID:n i samma Vercel-projekt (`equinet-staging-app`) -- den ena (`...HSFgtuY6...`) är vad `equinet-staging.johanlindengard.com` faktiskt pekar på just nu, den andra (`...A1S3vbfA...`) är dit man går tillbaka om något går fel. Produktionen (`equinet-app`) är ett helt separat Vercel-projekt och har bara haft EN deployment genom hela denna sprint -- den är alltså identisk med sitt eget rollback-mål tills en faktisk produktionsdeploy sker.

**Historik för frysningen:** en tidigare version av detta dokument (PR #513, innan merge) föreslog `759b7a75bb7637f623283aa08488f3aeb2728997` -- checkpoint-PR:ns egna commit, innehållsmässigt identisk med `main`-HEAD men vald bara för att den redan hade en bevisat grön CI-körning vid den tidpunkten. Johan instruerade uttryckligen att istället vänta in `main`-HEAD `4973f6e9...`s egen CI-körning och använda den som **enda** releasekandidat-SHA om den blev grön. Den blev grön (samtliga jobb, inkl. `Quality Gate Passed`). `759b7a75...` ska INTE användas för Slice 3.1 eller något senare steg -- `4973f6e9...` är den enda giltiga kandidaten från och med denna uppdatering.

## Verifierat, utan hemligheter

- **Produktionsworkflowet är `workflow_dispatch`-only.** `.github/workflows/deploy-production.yml`s `on:`-block innehåller enbart `workflow_dispatch`. Inget `push`, `pull_request`, `tag` eller `release` nämns.
- **Negativa triggerkontroller verifierade 2026-09-28:**
  - Push till `main` (PR #511 och #512:s egna merge-commits) triggade `deploy-production.yml` noll gånger.
  - En tillfällig testtagg (`test/deploy-gate-negative-check`, skapad och raderad samma session) triggade den noll gånger.
  - Dependabot-merge och release-event: strukturellt bevisat (inget sådant event nämns i `on:`), inte live-testat eftersom ingen Dependabot-PR eller release skapades för ändamålet.
- **Valideringslogiken testad med fem riktiga `workflow_dispatch`-körningar** (alla med `dry_run=true`, ingen produktionseffekt): ogiltigt SHA-format avvisas, SHA som inte finns på `main` avvisas, SHA på `main` utan grön quality-gates-körning avvisas, `staging_verified_sha`-mismatch utan `override_reason` avvisas, och en fullt giltig kombination går igenom `validate`-jobbet och in i `deploy`-jobbet.
- **`VERCEL_TOKEN` har roterats och verifierats.** Efter att Johan kört `scripts/sync-vercel-token.sh` (kräver hans egen interaktiva Vercel-session -- kan inte göras av en agent), dispatchades `deploy-production.yml` igen med `dry_run=true`. Stegen `Pull Vercel environment` och `Build` lyckades båda (se körning `36433870343`) -- det bevisar att token fungerar, utan att en enda rad deploy-relaterad kod någonsin kördes. Tokenvärdet är inte och har aldrig varit synligt i något loggutdrag eller i detta dokument.
- **Produktionen är oförändrad genom hela sprinten hittills:** verifierad flera gånger, senast efter Slice 3.1, fortfarande exakt SHA `42842022...` (PR #503).
- **Slice 3.1 klar:** releasekandidaten (`4973f6e919339b022425063bd8a280fa2bbe9b41`) force-pushad till `preview/candidate`. Vercel-deployment `dpl_6VHpb2b3bUzBzYoHcgxJN1oYyYhd` (`equinet-staging-app`, target=Preview) blev `READY` med rätt SHA i `meta.githubCommitSha`. `equinet-app` byggde också en (för produktionsformat) preview av samma branch, target=Preview -- normalt beteende, rör inget alias. **Det levande stagingaliaset (`equinet-staging.johanlindengard.com`) är opåverkat** -- fortfarande PR #503, bekräftat efteråt via `list_deployments`.
- **Slice 3.2 klar (2026-09-28):** manuell visuell rök-verifiering körd med Playwright MCP mot preview-deploymenten `dpl_6VHpb2b3bUzBzYoHcgxJN1oYyYhd` (`equinet-staging-app`, Preview-target, samma deployment som Slice 3.1, SHA `4973f6e919339b022425063bd8a280fa2bbe9b41` bekräftad via `meta.githubCommitSha`). Deploymenten är skyddad av Vercel Deployment Protection -- åtkomst skedde via en tillfällig, tidsbegränsad delningslänk genererad via Vercels egna verktyg (inte återgiven här), ingen inloggning med Johans Vercel-konto krävdes. Verifierat:
  - **Demo-läge aktivt**: landningssidan visar "Demo som hästägare" / "Demo som leverantör" -- `NEXT_PUBLIC_DEMO_MODE=true` fungerar på denna deploy.
  - **Auth**: demo-inloggning som hästägare routade korrekt till `/hem`; utloggning fungerade; demo-inloggning som leverantör routade korrekt till `/provider/calendar` (roll-baserad `/dashboard`-routing bekräftad i praktiken).
  - **Bokning end-to-end**: som demokunden Lisa Andersson bokades "Helskoning" (tisdag 29 sep 2026, 09:30--10:45) hos Järnfots Hovslageri för hästen Molly. Bokningen dök omedelbart upp i "Mina bokningar" med status "Väntar på svar" och bekräftelsetoast "Bokningsförfrågan skickad!". Efter utloggning och ny inloggning som leverantören (Erik Järnfot) syntes samma bokning direkt i leverantörskalendern (vecka 40, tisdag 29) med korrekt tid och status, plus bannern "3 bokningar väntar".
  - **Konsolfel**: inga app-relaterade fel. Enda avvikelserna var (a) ett CSP-block av Vercel Lives eget feedback-script (`vercel.live/_next-live/feedback/feedback.js`) -- harmlöst, rör bara Vercels egen toolbar, inte appfunktionalitet, och (b) en förväntad `401` på `/api/auth/session` innan inloggning.
  - **Inget levande Vercel-alias rördes**: enbart Preview-deploymenten användes, via delningslänk. `equinet-staging.johanlindengard.com` fick ingen ny deployment och pekar fortfarande på PR #503.
- **Viktigt: databaslagret delas mellan Preview och stagingaliaset.** `equinet-staging-app`s `DATABASE_URL` är konfigurerad med `target: ["production", "preview"]` -- ett och samma värde för alla deployments i projektet, inklusive Preview-deploymenten som Slice 3.2 testade mot. "Inget levande alias rördes" (Vercel-routningsnivå) betyder alltså INTE att ingen delad databas påverkades. Bokningen som skapades under rök-testet skrevs till samma Supabase-projekt (`zzdamokfeenencuggjjp`, "slot machine", Frankfurt) som det levande stagingaliaset använder. Detta upptäcktes och hanterades enligt nedan.
- **Verifiering och städning av testdata från Slice 3.2 (2026-09-28):**
  - **Identifiering**: bokningen som skapades under rök-testet identifierades entydigt via `createdAt`-tidsstämpeln (matchar exakt Playwright-navigeringens tidpunkt): `Booking.id = 6470adb4-c28f-4786-a378-1970017016ac`, kund Lisa Andersson, häst Molly, leverantör Erik Järnfot/Järnfots Hovslageri, tjänst Helskoning, tid tisdag 29 sep 2026 09:30--10:45, `createdAt = 2026-09-28 17:55:12.061`. Databas: Supabase-projekt `zzdamokfeenencuggjjp` (staging, delat projekt "slot machine").
  - **Bedömning**: `Lisa Andersson`/`Erik Järnfot` är etablerade fiktiva demo-personas (samma som används i seed-data och landningssidans demoknappar) -- inga verkliga personuppgifter. Bokningen ingick INTE i den ordinarie seed-baslinjen (de tre andra Molly/Helskoning-bokningarna i databasen har `createdAt` klustrat runt 2026-09-26 08:30, från seed-scriptet). Som fristående `pending`-bokning skulle den ha upptagit tidsluckan tis 29 sep 09:30--10:45 hos Järnfots Hovslageri och kunnat orsaka dubbelbokningskonflikt eller förvirrande avvikelse från baslinjen vid framtida seed-/smoke-körningar. Bedömning: tillfällig testdata, ska inte vara kvar som `pending`.
  - **Åtgärd**: bokningen avbokades via applikationens normala funktion -- inloggad som Lisa Andersson (demo), "Mina bokningar" -> "Avboka" -> bekräftat i dialogen "Ja, avboka". Ingen direkt databasåtgärd (DELETE/UPDATE via SQL) användes.
  - **Verifiering av slutläge**: `Booking.status` för exakt detta ID är nu `cancelled` (`updatedAt = 2026-09-28 18:02:18.037`, `createdAt` oförändrad). Radantalet i `Booking`-tabellen är oförändrat (21, samma som innan avbokningen -- UPDATE, ingen INSERT/DELETE). En riktad kontroll mot samma overlap-logik som `BookingService`/`PrismaBookingRepository` använder (`status in ('pending','confirmed')`) visar noll aktiva bokningar för Järnfots Hovslageri på tis 29 sep -- tidsluckan är fri för framtida tester. UI:t bekräftar visuellt: "Mina bokningar" -> Kommande visar "Inga kommande bokningar", tillbaka till baslinjeläget. Inga andra bokningar, användare eller rader i databasen berördes.
- **Slice 3.3 klar (2026-09-29): promotion till stagingaliasets levande deploy.** Johan gav uttryckligt, nytt godkännande i sessionen. Verktygets auto-mode-klassificerare blockerade agentens egen `request_promote`-anrop mot Vercel (klassad som "Production Deploy") -- Johan körde därför kommandot själv i sin egen interaktiva Vercel CLI-session (samma mönster som tidigare `VERCEL_TOKEN`-rotation och rollback-kommandon i sprinten). Detta definierar den tidigare okända mekaniken för Slice 3.3:
  - **Mekanism (nu bevisad)**: `vercel promote <preview-deployment-url> --scope cola500s-projects` mot en Preview-deployment (byggd från en branch, inte tidigare en production-deployment) resulterar INTE i en ren alias-flytt utan ombyggnad. Vercel CLI svarade: "This deployment is not a production deployment and cannot be directly promoted. A new deployment will be built using your production environment." -- en ny build av EXAKT samma Git-SHA (`4973f6e919339b022425063bd8a280fa2bbe9b41`) mot projektets production-environment krävdes och godkändes (`yes`). Resultat: ny deployment `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL` (target=production), samma källkod/commit som redan rök-verifierades i Slice 3.2, men en fristående build-artefakt.
  - **Verifiering efter bygget blev `READY`**: `list_deployment_aliases` för `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL` visar `equinet-staging.johanlindengard.com` (samt de tre Vercel-standardaliasen) -- aliaset har flyttats från den gamla deploymenten (`dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8`, SHA `42842022...`) till releasekandidaten.
  - **Hälsokoll**: `GET https://equinet-staging.johanlindengard.com/api/health` -> `200 OK`, `{"status":"ok","checks":{"database":"connected"}}`.
  - **Visuell koll**: landningssidan på det nu levande aliaset renderar korrekt med demo-läge aktivt (samma innehåll som redan verifierades i Slice 3.2, eftersom det är exakt samma källkod).
  - **Produktionen fortsatt oförändrad**: `equinet-app` (target=production) fortfarande `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `42842022...` (PR #503) -- verifierat efter promotionen.
  - **Nytt rollback-mål**: se uppdaterad "Rollbackplan för stagingsteget" nedan -- den gamla deploymenten `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8` finns kvar, inspekterbar, och är nu rollback-målet om Slice 3.3 behöver rullas tillbaka.
- **Sista preflight inför v0.3.0-release-utkast (2026-09-29, efter merge av Slice 3.3-checkpointen):** ny, oberoende kontroll av att staging fortfarande kör exakt releasekandidaten, utförd innan ett GitHub Release-utkast förbereds.
  - `get_deployment(dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL)` -> `meta.githubCommitSha = 4973f6e919339b022425063bd8a280fa2bbe9b41` (exakt match), `target = "production"`, `readyState = "READY"`, `alias` inkluderar `equinet-staging.johanlindengard.com`.
  - `GET https://equinet-staging.johanlindengard.com/api/health` -> `200 OK`, `{"status":"ok","checks":{"database":"connected"}}` (ny mätning, oberoende av Slice 3.3:s ursprungliga koll).
  - Produktion (`equinet-app`, target=production) verifierad på nytt: fortfarande `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `42842022...` (PR #503) -- helt oförändrad.
  - Lokal `main` matchar `origin/main` exakt (`9075ab0653b86b2dbfa5e4074af46ff2f4ccfc03`), arbetsytan ren (bortsett från kända, orelaterade ospårade filer). PR #517 bekräftat `MERGED`.
- **v0.3.0-release-utkast klart (2026-09-29):** release notes förberedda och ett GitHub Release-utkast skapat, utan att skapa någon Git-tagg.
  - **Metod**: eftersom `gh release create --help` uttryckligen dokumenterar att en saknad tagg "automatiskt skapas" (utan att undanta draft-läge), och detta motsäger vad GitHub Community-dokumentation säger gäller för det rena REST-API:et (draft=true skapar INTE en tagg-ref förrän publicering), undveks `gh release create`-bekvämlighetskommandot. Draften skapades istället direkt via `POST /repos/cola500/equinet/releases` (via `gh api`) med `draft: true`, `tag_name: "v0.3.0"`, `target_commitish: "4973f6e919339b022425063bd8a280fa2bbe9b41"`.
  - **Verifierat att ingen tagg skapades**: `git ls-remote --tags origin` kördes både före och efter draft-skapandet -- exakt samma tre taggar (`v0.1.0`, `v0.2.0`, `staging-pre-sync-2026-09-26`) i båda fallen. Releasens egen `html_url` bekräftar detta indirekt (`.../releases/tag/untagged-<hash>`, inte `.../tag/v0.3.0` -- GitHubs eget tecken på att taggen inte existerar än).
  - **Release-ID**: `398976758` (stabil identifierare -- använd denna, inte `html_url`). **`html_url`s `untagged-<hash>`-del ÄNDRAS vid varje PATCH mot draften** (GitHub genererar ett nytt internt spårnings-ID varje gång) -- synlig endast för repo-ägaren tills publicerad, då permalänken blir `/tag/v0.3.0`. Slå alltid upp aktuell `html_url` på nytt via `gh api repos/cola500/equinet/releases/398976758` istället för att lita på en tidigare sparad länk.
  - **Mål-commit verifierat**: `target_commitish` = `4973f6e919339b022425063bd8a280fa2bbe9b41` (exakt releasekandidaten).
  - **Ingen deployment triggas**: `grep -rl "release:" .github/workflows/*.yml` gav noll träffar -- inget workflow i repot lyssnar på `release`-events (varken `created`, `published` eller annat). Konsekvent med tidigare verifiering att `deploy-production.yml` enbart har `workflow_dispatch`.
  - **Release notes-källa**: kuraterade från README:s "Implementerade Funktioner", `standard-version --dry-run`s BREAKING CHANGES-sektion, samt denna checkpoints egna verifieringsresultat. Fullständig text sparad lokalt i scratchpad (`v0.3.0-release-notes.md`) och i release-utkastets `body`-fält.
  - **`npm run release`/`standard-version` kördes ALDRIG på riktigt** -- endast `--dry-run` (research, inga sidoeffekter, verifierat via `git status` + `package.json`-version oförändrad direkt efteråt). `package.json`, `package-lock.json` och `CHANGELOG.md` är alla oförändrade.
  - **Draften är INTE publicerad.** Publicering, taggning och produktionsdeploy kräver separat, nytt uttryckligt godkännande -- se "Tydlig paus- och återupptagningspunkt: FÖRE produktion" nedan.
- **Rättelse av release notes + slutkontroll (2026-09-29, samma dag, efter Johans granskning):** `standard-version --dry-run`s automatiska BREAKING CHANGES-detektering hade felaktigt klassat `/api/providers`s paginerade svarsformat som en breaking change för v0.3.0. Verifierat felaktigt:
  - `git log --follow -- src/app/api/providers/route.ts` visar att pagineringen infördes i commit `99c509c2` (`2026-01-27`) -- **5 dagar efter v0.2.0** (`2026-01-22`), dvs i praktiken i början av hela v0.3.0-utvecklingsperioden, inte en färsk ändring i denna release.
  - Webb-konsumenten (`src/hooks/useProviderSearch.ts:125`) läser redan `result.data` -- redan anpassad, inget aktuellt uppgraderingsproblem.
  - Ingen träff för `/api/providers` i `ios/` -- ingen iOS-konsument berörs alls.
  - **Åtgärd**: "Breaking changes"-avsnittet togs bort helt från release-utkastets `body` (inte omformulerat till en historisk notering -- bedömdes inte tillföra värde i ett "vad är nytt"-dokument för en 8 månader gammal, redan fullt absorberad ändring). Uppdaterat via `gh api ... -X PATCH -f body=@<fil>`.
  - **Bieffekt upptäckt och åtgärdad**: PATCH-anropet (som bara skickade `body`) fick GitHub att nollställa draftens `tag_name` från `v0.3.0` till ett auto-genererat `untagged-<hash>` -- ett känt kvirk i GitHubs Releases API för otaggade drafts (PATCH utan explicit `tag_name` kan tappa den tilltänkta taggen). Upptäckt genom oberoende `GET` direkt efter PATCH, åtgärdat med en uppföljande `PATCH` som explicit satte `tag_name=v0.3.0` + `target_commitish` igen. Verifierat på nytt efteråt: `tag_name=v0.3.0` korrekt, och `git ls-remote --tags origin` visar fortfarande bara de tre kända taggarna -- ingen riktig Git-tagg skapades av någon av PATCH-anropen.
  - **Lärdom för framtida uppdateringar av denna draft**: en PATCH mot `/repos/.../releases/398976758` MÅSTE alltid inkludera `tag_name=v0.3.0` (och gärna `target_commitish`) explicit, annars riskerar draften att tappa sin tilltänkta version igen.

## Inte gjort

- **Ingen tagg har skapats** (den tillfälliga testtaggen för det negativa triggertestet skapades och raderades samma session -- se ovan; verifierat att v0.3.0-release-utkastet heller inte skapade någon tagg, se ovan).
- **Ingen GitHub Release är publicerad.** Ett draft-utkast för v0.3.0 finns (`id: 398976758`, se ovan) -- `gh release list` visar den fortsatt inte (drafts listas inte som publicerade releaser).
- **Ingen produktionsdeploy har körts** (`dry_run` har alltid varit `true` i varje test-dispatch mot `deploy-production.yml`; `equinet-app` är fortfarande oförändrad på SHA `42842022...`).

## Kända blockerare och återstående slices

- **GDPR-öppna frågor** (bolagsuppgifter, DPO-beslut, SCC-status för amerikanska underleverantörer) kvarstår som Johans/juridisk rådgivnings beslut, orört av denna sprint. Nämnt explicit som känd begränsning i v0.3.0-release-utkastets release notes.
- **CHANGELOG.md är INTE uppdaterad** -- `standard-version` kördes endast som `--dry-run` (research). En riktig körning (`npm run release:minor`) skulle bumpa `package.json`-versionen, skriva `CHANGELOG.md` och skapa en lokal Git-tagg -- görs medvetet INTE förrän Johan godkänner att gå vidare mot faktisk taggning/publicering.
- **GitHub Release-utkast (Workstream 6) är klart** -- draft `id: 398976758` skapat för v0.3.0, mål-SHA `4973f6e919339b022425063bd8a280fa2bbe9b41`, ingen tagg skapad. Väntar på Johans godkännande för publicering.
- **Vercel-auto-mode-klassificeraren blockerar agentens direkta `request_promote`-anrop** (klassad "Production Deploy"), oavsett godkännande i konversationen. Framtida promotions mot `equinet-staging-app` eller `equinet-app` kräver därför Johans egen interaktiva `vercel promote`-körning, precis som tokenrotation och rollback redan gjorde. Dokumenterat som ett etablerat mönster, inte en öppen fråga.

## Paus- och återupptagningsprotokoll

### 1. Så här verifierar nästa agent att repot och externa miljöer fortfarande matchar checkpointen

```bash
cd equinet
git fetch origin main
git log -1 --format='%H %ad %s' --date=iso origin/main   # jämför mot "Nuläge (SHA:er)" ovan
git status --short                                          # ska vara rent (bortsett från kända ospårade filer)
gh pr list --state open --json number,title                 # bör vara tomt, eller bara nya, oberoende PR:ar
gh run list --workflow=deploy-production.yml --limit 5       # bör bara visa tidigare kända test-körningar
```

Jämför resultatet mot tabellen i "Nuläge (SHA:er)" och listan i "Verifierat, utan hemligheter". Läs ALLTID den senaste versionen av detta dokument på `main` innan något annat görs -- det kan ha uppdaterats av en annan session sedan sist.

### 2. Read-only-kontroller innan arbetet återupptas

- `git log -1 origin/main` -- har `main` rört sig sedan denna checkpoint skrevs? Om ja: läs de nya commit-meddelandena innan du antar att de är ofarliga.
- Vercel `list_deployments` (target=production) för både `equinet-app` och `equinet-staging-app` -- matchar SHA:erna fortfarande tabellen ovan? Om inte: någon annan har deployat under tiden -- stanna och ta reda på vem/vad innan du fortsätter.
- `gh run list --workflow=deploy-production.yml` -- finns det körningar med `dry_run=false` som inte är kända från detta dokument? Om ja: stanna, det betyder en riktig produktionsdeploy skedde utanför denna dokumenterade process.

### 3. Nästa säkra steg

Slice 3.1, 3.2 och 3.3 är klara. `equinet-staging.johanlindengard.com` (stagingaliaset) kör nu releasekandidaten (`4973f6e919339b022425063bd8a280fa2bbe9b41`, deployment `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL`), verifierad med hälsokoll och visuell koll. Produktionen (`equinet-app`) är fortfarande helt oförändrad. Workstream 3 (staging av exakt releasekandidat) är därmed klar.

**Workstream 5/6 är klara** (release notes förberedda, GitHub Release-utkast skapat för v0.3.0 -- se "Verifierat" ovan). **En eventuell produktionsdeploy (Workstream 4, `deploy-production.yml` med `dry_run=false`), publicering av release-utkastet, eller skapande av en riktig Git-tagg kräver alltjämt Johans nya, uttryckliga godkännande i den aktuella sessionen** -- godkännandet av Slice 3.1--3.3 och release-utkastets skapande gäller INTE automatiskt för dessa nästa steg.

**Status vid denna checkpoint-uppdatering (2026-09-29):**
- Releasekandidat-SHA: `4973f6e919339b022425063bd8a280fa2bbe9b41`, grön `Quality Gate Passed` (se "Nuläge (SHA:er)").
- Rök-verifierad på `preview/candidate` (Slice 3.2) och på det levande stagingaliaset efter promotion (Slice 3.3).
- Stagingaliasets levande deployment: `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL`, SHA `4973f6e9...` -- **detta är det NYA rollback-målet om något går fel** (se uppdaterad rollbackplan nedan för hur man går tillbaka till föregående deployment).
- Produktionens levande deployment (`equinet-app`): fortfarande `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `42842022...` (PR #503) -- oförändrad.
- Testdata från Slice 3.2 är avbokad (status `cancelled`), ingen kvarvarande `pending`/`confirmed`-konflikt i staging-databasen.

### 4. Avvikelser som kräver stopp och nytt beslut

- `main` har fått nya commits sedan senaste läsning av detta dokument, av någon annan än den pågående sessionen.
- Staging- eller produktions-SHA i Vercel matchar inte längre tabellen ovan.
- En `deploy-production.yml`-körning med `dry_run=false` existerar som inte är initierad och godkänd av Johan i den aktuella sessionen.
- `Quality Gate Passed` är rött för den tilltänkta releasekandidat-SHA:n.
- Arbetsytan är inte ren, eller lokal `main` matchar inte `origin/main`.
- Något GDPR-, säkerhets- eller drifts-relaterat fynd som kräver mänsklig bedömning enligt tidigare sprintarbete.

### 5. Åtgärder som ALDRIG får antas vara godkända

- **Produktionsdeploy** (`dry_run=false` i `deploy-production.yml`) -- kräver alltid Johans uttryckliga, aktuella instruktion att deploya en bestämd, verifierad SHA. En tidigare given instruktion gäller INTE automatiskt för en ny SHA.
- **Skapande av en riktig Git-tagg** för en release (verifierat att detta INTE skedde när v0.3.0-draften skapades -- se "Verifierat" ovan; om samma väg används igen, verifiera på nytt).
- **Publicering av en GitHub Release** (draft -> published), eller markering som pre-release. Ett DRAFT-utkast (som v0.3.0, `id: 398976758`) är uttryckligen godkänt att skapas -- se detta dokuments historik -- men publicering är ett separat, ej godkänt steg.
- **Skrivning mot en fjärrdatabas** (staging eller produktion).
- **Ändring av produktionskonfiguration** (Vercel-projektinställningar, environment-variabler, `vercel.json`, DNS).

Att CI är grönt, att en PR är mergad, eller att en tidigare slice godkändes, innebär ALDRIG i sig tillstånd för någon av dessa fem åtgärder.

## Rollbackplan för stagingsteget

Gäller Workstream 3 (staging av exakt releasekandidat). **Status (2026-09-29): Slice 3.3 är genomförd -- stagingaliaset kör nu releasekandidaten. Denna plan är därmed aktiv, inte längre hypotetisk.**

**Föregående stagingdeployment och alias (rollback-målet om Slice 3.3 behöver ångras):**
Deployment-ID `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8`, SHA `42842022...` (PR #503). Denna deployment finns kvar, inspekterbar, orörd -- bara aliaset flyttades.

**Nuvarande (efter Slice 3.3) stagingdeployment och alias:**
Deployment-ID `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL`, SHA `4973f6e919339b022425063bd8a280fa2bbe9b41` (releasekandidaten), `equinet-staging.johanlindengard.com`.

**Så här återställs det gamla stagingaliaset (om en rollback-trigger nedan inträffar):**
`vercel rollback` eller `vercel promote dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8 --scope cola500s-projects` mot `equinet-staging-app` (kräver Johans Vercel-session, samma som tokenrotationen och Slice 3.3-promotionen -- agentens auto-mode-klassificerare blockerar denna typ av åtgärd). Ingen av dessa kommandon rör produktionen (separat Vercel-projekt).

**Så här lämnas den nya deploymenten orörd/tas ur trafik utan att radera bevis:**
En ny Vercel-deployment som visar sig felaktig ÅTERKALLAS aldrig genom att raderas -- `vercel rollback` byter bara vilken deployment som ligger bakom aliaset. Den felaktiga deploymenten finns kvar, inspekterbar via sin egen `*.vercel.app`-URL och `inspectorUrl`, för felsökning i efterhand.

**Miljövariabler och databasmigrationer vid rollback:**
Stagingmiljön har sin egen, separata Supabase-databas (`zzdamokfeenencuggjjp`, Frankfurt) -- oberoende av produktionens. Om releasekandidaten innehåller nya Prisma-migrationer som redan applicerats mot staging-databasen INNAN en rollback av koden: migrationerna rullas INTE automatiskt tillbaka av en Vercel-rollback (den byter bara vilken kod som körs, inte databasschemat). Kontrollera `npm run migrate:status` mot staging efter en rollback -- om koden är äldre än schemat kan det uppstå en missmatch som kräver manuell bedömning, inte en automatisk databas-rollback.

**Tydliga rollback-triggers (någon av dessa -> rulla tillbaka omedelbart):**
- Fel SHA deployad (matchar inte den frysta releasekandidaten)
- Fel Vercel-projekt eller fel target (t.ex. av misstag mot produktion)
- Demo-läge (`NEXT_PUBLIC_DEMO_MODE`) fungerar inte som förväntat på staging
- Miljö- eller databasblandning (stagingmiljön verkar prata med fel Supabase-projekt, eller tvärtom)
- Auth-/sessionsläcka (en användares session eller cache syns för en annan)
- Ett blockerande demoflöde (leverantörs- eller hästägardemo går inte att slutföra)
- `/api/health` svarar inte med 200 inom rimlig tid efter deploy

**Verifiering att produktionen förblir oförändrad:**
Efter varje stagingrelaterad åtgärd: `list_deployments` (target=production) mot `equinet-app` -- SHA:n ska fortfarande vara `42842022...` tills en separat, explicit godkänd produktionsdeploy sker. Detta ska köras och dokumenteras vid varje checkpoint-uppdatering i detta dokument tills produktionen faktiskt uppdateras med Johans godkännande.

## Rollbackplan för produktion (inför en framtida, separat godkänd produktionsdeploy)

Gäller Workstream 4 (produktionsdeploy), som INTE har påbörjats -- ingen `deploy-production.yml`-körning med `dry_run=false` har skett.

**Nuvarande produktionsdeployment (rollback-målet om/när en framtida produktionsdeploy behöver ångras):**
Deployment-ID `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `4284202221f07216269659873cacf1f9b9f64f04` (PR #503), `equinet-app` (target=production). Detta är den deployment produktionen alltid kan återgå till fram tills en ny produktionsdeploy faktiskt sker.

**Så här skulle en framtida produktionsrollback göras:**
`vercel rollback` eller `vercel promote dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa --scope cola500s-projects` mot `equinet-app` (kräver Johans Vercel-session -- agentens auto-mode-klassificerare blockerar denna typ av åtgärd, se Slice 3.3-erfarenheten ovan). Separat Vercel-projekt från staging -- rör aldrig `equinet-staging-app`.

**Databas:** produktionen använder ett helt separat Supabase-projekt (`xybyzflfxnqqyxnvjklv`, Zurich) -- oberoende av stagingens `zzdamokfeenencuggjjp`. Samma migrations-varning som för staging gäller: en Vercel-rollback återställer aldrig databasschemat automatiskt.

## Tydlig paus- och återupptagningspunkt: FÖRE produktion

**Detta är den aktuella statusen (2026-09-29):** release-ready-sprinten har verifierat och stagat releasekandidaten (`4973f6e919339b022425063bd8a280fa2bbe9b41`) hela vägen till `equinet-staging.johanlindengard.com`. Ett GitHub Release-utkast för v0.3.0 (`id: 398976758`, `target_commitish` = releasekandidaten) är skapat -- se "Verifierat, utan hemligheter" ovan för fullständiga detaljer och länk.

**Explicit stopp här.** Följande har INTE skett och ska INTE ske utan att Johan uttryckligen initierar det i en ny, aktuell instruktion:
- Ingen riktig Git-tagg är skapad (verifierat två gånger via `git ls-remote --tags origin`).
- Release-utkastet för v0.3.0 är INTE publicerat (fortfarande `draft: true`).
- `CHANGELOG.md`/`package.json` är INTE uppdaterade -- `standard-version` har enbart körts som `--dry-run`.
- `deploy-production.yml` har aldrig körts med `dry_run=false`.
- Produktionen (`equinet-app`) är fortfarande exakt PR #503, `42842022...`.

En ny session som återupptar arbetet ska läsa denna sektion FÖRST och behandla den som den auktoritativa statusen -- inte anta att release-utkastets existens (draft) betyder att publicering eller produktionsdeploy är godkänt.
