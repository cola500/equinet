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
  - "v0.3.0 ÄR SLÄPPT (2026-09-29) -- release-ready-sprinten är avslutad"
  - "Dataklassificering: v0.3.0 är en Customer Preview (endast fiktiv testdata)"
  - Slutförda slices
  - Mergade PR:ar och commits
  - Nuläge (SHA:er)
  - "Regel: vad flyttar den frysta produktkandidaten"
  - Verifierat, utan hemligheter
  - Inte gjort
  - Kända blockerare och återstående slices
  - Framtida krav före användning med riktiga personuppgifter
  - Paus- och återupptagningsprotokoll
  - Rollbackplan för stagingsteget
  - Rollbackplan för produktion (inför en framtida, separat godkänd produktionsdeploy)
  - "Paus- och återupptagningspunkt: EFTER produktionsrelease (historisk -- steget är genomfört)"
---

# Release-Ready Sprint -- Checkpoint

## Syfte

Detta dokument är den enda källan till sanning för var release-ready-sprinten står, för en människa eller en ny agent-session som behöver återuppta arbetet utan att gissa. Uppdateras vid varje betydande checkpoint. Ersätter INTE sprintplanen (publicerad som Artifact, "Release-Ready Sprint") -- den beskriver *vad* som ska göras och i vilken ordning; detta dokument beskriver *var vi faktiskt står just nu*.

**Ingen hemlig information finns eller ska någonsin läggas till i detta dokument** -- inga tokenvärden, inga secret-namn utöver vad som redan är offentligt dokumenterat i `docs/operations/vercel-token-sync-and-production-deploy.md`, inga databas-URL:er eller uppkopplingssträngar.

## v0.3.0 ÄR SLÄPPT (2026-09-29) -- release-ready-sprinten är avslutad

**Detta är den auktoritativa slutstatusen.** Johan gav uttryckligt godkännande för produktionsdeploy, tagg och publicering 2026-09-29. Allt genomfört i given ordning, med en stopp-och-åtgärda-cykel för en genuin blockerare (ogiltig `VERCEL_TOKEN`) på vägen.

### Produktionsdeploy

- **Deployad SHA**: `4973f6e919339b022425063bd8a280fa2bbe9b41` (produktkandidaten, oförändrad sedan Slice 3.1--3.3).
- **Ny produktionsdeployment**: `dpl_5v8gEkuRDeg1TmWZBB6CJNuj7Shj` (`equinet-app`, target=production), `state: READY`.
- **Workflow-körning**: `deploy-production.yml`, `dry_run=false`, run-ID `36584375136` -- `Validate deploy candidate` och `Deploy to Production` båda `success`.
- **Nytt rollback-mål**: `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `4284202221f07216269659873cacf1f9b9f64f04` (PR #503) -- föregående produktionsdeployment, live genom hela release-sprinten fram till denna deploy. Finns kvar, inspekterbar, orörd.

### Blockerare hittad och löst under preflighten (2026-09-29, samma dag)

En första `dry_run=true`-körning (`36582792319`) misslyckades: `Error: The token provided via --token argument is not valid.` -- `VERCEL_TOKEN` hade slutat fungera sedan den senaste verifieringen tidigare i sprinten. Johan körde `bash scripts/sync-vercel-token.sh` i sin egen Vercel-session. En ny `dry_run=true`-körning (`36583908788`) verifierade båda jobben gröna innan den riktiga deployen (`dry_run=false`) startades. Ingen produktionspåverkan skedde under den misslyckade dry_run-körningen (dry_run muterar aldrig produktionen).

### Migrationsavvikelse -- utredd, bedömd ofarlig, INTE en blockerare

`20260906120000_enable_rls_staging_parity_ten_tables` finns i produktkandidatens kod men saknas i produktionens `_prisma_migrations`-tabell (verifierat via direkt SQL-fråga mot `xybyzflfxnqqyxnvjklv`). Migrationens egen kommentar förklarar varför: den är en **staging-parity-fix** -- produktionen hade redan RLS aktiverat på dessa tio tabeller (via tidigare, ospårad manuell/historisk ändring), bara staging saknade det. Verifierat direkt mot produktionsdatabasen (`pg_class.relrowsecurity`) innan deploy: samtliga tio tabeller har `rls_enabled: true`. Migrationen (`ENABLE ROW LEVEL SECURITY`, idempotent) skulle vara en ren no-op om körd mot produktion. Ingen migrering applicerades eller behövde appliceras för denna deploy.

### Kontroll efter deploy (2026-09-29, direkt efter deploy), alla punkter gröna

- **Domän**: `equinet.johanlindengard.com` bekräftat i `dpl_5v8gEkuRDeg1TmWZBB6CJNuj7Shj`s aliaslista.
- **SHA**: `get_deployment`/`list_deployments` bekräftar `meta.githubCommitSha = 4973f6e919339b022425063bd8a280fa2bbe9b41`.
- **Hälsokoll**: `GET /api/health` -> `200 OK`, `{"status":"ok","checks":{"database":"connected"}}`.
- **Startsida, `/providers`, `/login`**: alla renderar korrekt (Playwright-skärmdumpar tagna). `/providers` visar 7 riktiga leverantörer (befintlig produktionsdata, t.ex. "Spikes Hovservice", "Test Stall AB") -- orörd av denna deploy, som bara ändrade kod, ingen databas.
- **Demo-läge**: INTE aktivt -- ingen demo-panel på startsidan, `/login` visar ett riktigt email/lösenord-formulär utan demo-genvägar (skiljer sig korrekt från stagings UI).
- **Databas**: klientkod bekräftat anropar `xybyzflfxnqqyxnvjklv.supabase.co` (produktionens Supabase-projekt, separat från stagingens `zzdamokfeenencuggjjp`) -- verifierat via faktisk nätverkstrafik i en riktig browser-session, inte antaget.
- **Inga nya app-relaterade fel**: konsolfel var `401` på `/api/auth/session` (förväntat, ej inloggad), samt Vercels egna `429`/`404` på manifest/insights-script (Vercel-infrastruktur, inte Equinet-kod) -- samma brusmönster som setts genomgående i sprinten, inget nytt eller blockerande.
- **Staging**: bekräftat fortsatt frisk och helt separat (`GET https://equinet-staging.johanlindengard.com/api/health` -> `200 OK` direkt efter produktionsverifieringen).
- **Ingen skarp testdata skapad**: inget konto registrerades, ingen bokning gjordes i produktionen under verifieringen (produktionen har inget demo-läge, så sådan data skulle räknas som skarp -- i strid med Customer Preview-policyn). Endast icke-muterande sidladdningar användes.

### Tagg

- **`v0.3.0`**, annoterad tagg, skapad lokalt och pushad till `origin`.
- **Verifierat mål (två oberoende metoder)**: `git ls-remote --tags origin` visar `refs/tags/v0.3.0^{}` (dereferenserad) = `4973f6e919339b022425063bd8a280fa2bbe9b41`. GitHub API (`git/tags/<tag-sha>`) bekräftar samma sak: taggobjektets `object.sha` = `4973f6e919339b022425063bd8a280fa2bbe9b41`.

### GitHub Release -- PUBLICERAD

- **URL**: https://github.com/cola500/equinet/releases/tag/v0.3.0
- **Titel**: "Equinet v0.3.0 – Customer Preview"
- **Status**: `draft: false` (publicerad), `prerelease: true`, `tag_name: v0.3.0`, `target_commitish: 4973f6e919339b022425063bd8a280fa2bbe9b41`.
- Verifierat efter publicering via två oberoende kommandon (`gh api` och `gh release view`) -- samma resultat båda gångerna.
- Release notes innehåller den framträdande Customer Preview-varningsrutan (fiktiv testdata, tidig förhandsvisning) som skrevs under GDPR-omklassificeringen -- se historiken i "Verifierat, utan hemligheter" nedan.

### Kända begränsningar (oförändrade av denna deploy, redan dokumenterade)

- GDPR-arbetet (bolagsuppgifter, DPO-bedömning, personuppgiftsbiträdesavtal, SCC-status) kvarstår som framtida krav -- se "Framtida krav före användning med riktiga personuppgifter". Blockerar inte denna Customer Preview.
- Migrationsspårnings-avvikelsen ovan (`20260906120000_enable_rls_staging_parity_ten_tables`) kvarstår i `_prisma_migrations` som "ej applicerad" trots att SQL-effekten redan finns -- kosmetiskt, men värt att städa upp i en framtida, separat migration som markerar den `resolve --applied` om det blir förvirrande.
- Ingen fullständig regressionskörning av samtliga ~4946 tester har körts specifikt mot DENNA produktionsdeploy (CI:s testsvit körs i CI-miljö). Manuell verifiering ovan täcker kärnflöden, inte samtliga funktioner.

## Dataklassificering: v0.3.0 är en Customer Preview (endast fiktiv testdata)

**Fastställt av Johan 2026-09-29.** Detta gäller v0.3.0-produktkandidaten (`4973f6e919339b022425063bd8a280fa2bbe9b41` -- se "Regel: vad flyttar den frysta produktkandidaten" nedan för varför detta är den enda SHA:n som räknas) i alla miljöer den körs i, inklusive `equinet-staging.johanlindengard.com` idag och en eventuell framtida produktionsdeploy.

- **v0.3.0 är en Customer Preview / pre-release för demonstration och återkoppling** -- inte en bred, skarp lansering till riktiga slutanvändare.
- **Endast fiktiv testdata får finnas i miljön**: demo-personas och seed-data (t.ex. "Lisa Andersson", "Erik Järnfot"/Järnfots Hovslageri -- se Slice 3.2-verifieringen ovan). Detta är samma etablerade demo-datamodell som redan används i `NEXT_PUBLIC_DEMO_MODE`.
- **Ingen skarp kund-, häst-, boknings-, betalnings- eller kontaktinformation får läggas in** i någon miljö som kör denna release-kandidat -- varken i staging eller i en eventuell framtida produktionsdeploy -- **förrän GDPR-arbetet nedan är slutfört.**
- **GDPR-arbetet är följaktligen INTE en blockerare för att dela ut v0.3.0 som Customer Preview med fiktiv data.** Det är däremot ett förutsättningskrav som måste vara uppfyllt innan plattformen tas i bruk med riktiga personuppgifter (dvs. innan en bred, skarp lansering). Se "Framtida krav före användning med riktiga personuppgifter" under "Kända blockerare och återstående slices" för den fullständiga, orörda listan (bolagsuppgifter, DPO-bedömning, personuppgiftsbiträdesavtal, SCC-status).
- Denna klassificering är också införd i release-utkastets `body` (GitHub Release `id: 398976758`) -- se "Verifierat, utan hemligheter" nedan för detaljer om den uppdateringen.

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
| 5/6 | Release notes förberedda + GitHub Release-utkast (draft) skapat för v0.3.0, pekar på produktkandidaten `4973f6e9...` | ✅ Klar, verifierad (se nedan) |
| 7 | Impeccable `PRODUCT.md`/`DESIGN.md`/sidecar tillagda (PR #521) -- ren dokumentation/metadata, ingen körbar kod. **Rättelse 2026-09-29**: felaktigt behandlad som en ny produktkandidat under en kort period samma dag; korrigerat -- se "Regel: vad flyttar den frysta produktkandidaten" nedan. `4973f6e9...` är och förblir produktkandidaten | ✅ Klar, rättad och verifierad (se nedan) |

## Mergade PR:ar och commits

| PR | Titel | Merge-commit på `main` |
|----|-------|------------------------|
| [#511](https://github.com/cola500/equinet/pull/511) | ci(deploy): produktionsdeploy blir workflow_dispatch-only, kräver explicit SHA | `ae2389517d10e03fef01927e5866ab1a13bbce4b` |
| [#512](https://github.com/cola500/equinet/pull/512) | ci(deploy): låt dry_run köra Pull+Build på riktigt för att verifiera VERCEL_TOKEN | `527c2e80f3311dc76a7b26d121918a113a1e6390` |

Dessförinnan, samma dag, i samma sprint-kontext (dependabot-auto-merge-säkring och PR-städning som ledde fram till denna release-sprint): PR #509, #510, #486, #463, #465, #505, #504 (stängd som överspelad), #474 -- se `docs/operations/dependabot.md` och `docs/operations/staging-environment-setup.md` för respektive sakinnehåll.

## Nuläge (SHA:er)

Senast verifierat 2026-09-29 (efter rättelse -- se "Regel: vad flyttar den frysta produktkandidaten" nedan).

| Vad | SHA | Deployment-ID | Källa |
|-----|-----|----------------|-------|
| **Verifierad produktkandidat (enda giltiga, oförändrad sedan Slice 3.1--3.3)** | **`4973f6e919339b022425063bd8a280fa2bbe9b41`** | -- | `main`-HEAD direkt efter checkpoint-PR #513. Grön `Quality Gate Passed` (körning `36435973623`). Manuellt rök-verifierad (Slice 3.2) och stagad (Slice 3.3). Detta är SHA:n release-utkastet och en framtida produktionsdeploy avser peka på |
| **Senare doc-/metadata-commits på `main`** (rör INTE produktkandidaten) | `66fa2360...` (PR #521: `PRODUCT.md`/`DESIGN.md`/sidecar) och `e499b84fc8ec99a9b962fa75dc474707cea770e9` (PR #522: checkpoint-korrigering) | -- | Enbart `docs/`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` -- verifierat innehåller noll ändringar i `src/`, `prisma/`, `ios/`, `package.json`, `next.config.*`, `vercel.json`, `.github/workflows/`, `tsconfig`. Se "Regel" nedan för varför detta inte flyttar produktkandidaten |
| **Staging -- NUVARANDE LIVE deployment** (`equinet-staging-app`, target=production, `equinet-staging.johanlindengard.com`) | `66fa2360a77f3c23fb1d03deb0b350d972ddc5bc` (en doc-commit, men **källkoden är byte-för-byte identisk med produktkandidaten** `4973f6e9...` -- PR #521 ändrade inget i `src/` eller övrig körbar kod) | `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa` | Vercel `list_deployment_aliases` + `get_deployment`. Ingen ny stagingdeploy krävs för att "rätta till" detta -- den körande koden motsvarar redan produktkandidaten fullt ut, se "Regel" nedan |
| **Staging -- ROLLBACK-MÅL** (samma projekt, INTE live just nu) | `4973f6e919339b022425063bd8a280fa2bbe9b41` (produktkandidaten själv, byggd separat i Slice 3.3) | `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL` | Finns kvar, inspekterbar, orörd. Se "Rollbackplan för stagingsteget" |
| **Produktion -- NUVARANDE LIVE deployment** (`equinet-app`, target=production) | `4284202221f07216269659873cacf1f9b9f64f04` (PR #503) | `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa` | Vercel `list_deployments` -- **bekräftat oförändrad, verifierad flera gånger genom hela sprinten** |
| **Produktion -- ROLLBACK-MÅL vid en framtida deploy** | Samma som ovan (produktionen har ännu inte deployats om) | Samma som ovan, `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa` | Produktionen är just nu sitt eget rollback-mål -- blir relevant först när/om en framtida produktionsdeploy sker. Se "Rollbackplan för produktion" |

**Viktigt att inte blanda ihop:** "produktkandidat" (den Git-SHA release-utkastet/taggen/en framtida produktionsdeploy avser) och "senaste `main`-HEAD" (som kan ligga steg före pga rena doc-commits) är INTE samma sak från och med denna rättelse. Stagingaliaset råkar just nu köra en deployment byggd från en doc-commit-SHA (`66fa2360...`) snarare än produktkandidat-SHA:n direkt -- det är ofarligt eftersom källkoden är identisk, men dokumentationen ska ALDRIG beskriva detta som att produktkandidaten "flyttat sig".

## Regel: vad flyttar den frysta produktkandidaten

**Fastställt av Johan 2026-09-29, efter en felaktig tillämpning samma dag (se nedan).**

- Produktkandidaten (den SHA som release-utkastet, en framtida Git-tagg och en framtida produktionsdeploy avser) är **`4973f6e919339b022425063bd8a280fa2bbe9b41`**. Den ändras INTE av senare commits på `main` bara för att de råkar komma efter den kronologiskt.
- **En ny produktkandidat krävs FÖRST om en commit ändrar**: körbar kod (`src/`, `ios/`), beroenden (`package.json`/`package-lock.json`), migreringar (`prisma/`), miljökonfiguration, eller bygg-/deploybeteende (`next.config.*`, `vercel.json`, `.github/workflows/`).
- **Ren dokumentation och icke-körbar designmetadata flyttar INTE produktkandidaten**: `docs/`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/`, checkpoint-uppdateringar, release notes-text. Sådana commits får ligga senare på `main` utan att kräva en ny produktdeploy, en ny stagingomgång eller en ny fullständig rök-verifiering.
- **Vad detta innebär i praktiken**: `main`-HEAD och "produktkandidaten" kan vara olika SHA:er samtidigt, så länge skillnaden mellan dem enbart är dokumentation/metadata. Detta dokument ska alltid vara explicit om vilken av de två som avses.

**Vad som gick fel (2026-09-29, samma dag, rättat inom timmar):** PR #521 (Impeccable `PRODUCT.md`/`DESIGN.md`/sidecar -- ren dokumentation) behandlades felaktigt som att den "ersatte" produktkandidaten med sin egen merge-commit-SHA (`66fa2360...`), vilket i sin tur triggade en HELT ONÖDIG ny stagingpromotion (force-push till `preview/candidate`, ny Vercel-build, ny `vercel promote`-körning av Johan). Ingen skada skedde (samma källkod deployades bara två gånger), men det var en felaktig tillämpning av principen som tidigare användes för att gå från `759b7a75...` till `4973f6e9...` (som VAR en giltig kandidat-ersättning, eftersom `4973f6e9...` var checkpoint-PR:ns egen, ursprungliga verifieringspunkt -- inte en efterföljande doc-ändring ovanpå en redan rök-verifierad och stagad kandidat). Skillnaden: `759f7a75...`→`4973f6e9...` var ett val MELLAN två kandidater till SAMMA ursprungliga frysningsbeslut, innan något stagats. `4973f6e9...`→`66fa2360...` var en efterföljande, ren dokumentationsändring EFTER att kandidaten redan var fullt verifierad och stagad -- en annan situation som denna nya regel nu särskiljer.

**Historik för frysningen:** en tidigare version av detta dokument (PR #513, innan merge) föreslog `759b7a75bb7637f623283aa08488f3aeb2728997` -- checkpoint-PR:ns egna commit, innehållsmässigt identisk med `main`-HEAD men vald bara för att den redan hade en bevisat grön CI-körning vid den tidpunkten. Johan instruerade uttryckligen att istället vänta in `main`-HEAD `4973f6e9...`s egen CI-körning och använda den som **enda** releasekandidat-SHA om den blev grön. Den blev grön (samtliga jobb, inkl. `Quality Gate Passed`). `759b7a75...` ska INTE användas för något steg i denna sprint. `4973f6e9...` är, och förblir, den enda giltiga produktkandidaten -- se "Regel" ovan.

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
  - **Åtgärd (metoden misslyckades tyst, se nästa punkt för den faktiska korrigeringen)**: avsikten var att ta bort "Breaking changes"-avsnittet via `gh api ... -X PATCH -f body=@<fil>`.
  - **Bieffekt upptäckt och åtgärdad**: PATCH-anropet (som bara skickade `body`) fick GitHub att nollställa draftens `tag_name` från `v0.3.0` till ett auto-genererat `untagged-<hash>` -- ett känt kvirk i GitHubs Releases API för otaggade drafts (PATCH utan explicit `tag_name` kan tappa den tilltänkta taggen). Upptäckt genom oberoende `GET` direkt efter PATCH, åtgärdat med en uppföljande `PATCH` som explicit satte `tag_name=v0.3.0` + `target_commitish` igen. Verifierat på nytt efteråt: `tag_name=v0.3.0` korrekt, och `git ls-remote --tags origin` visar fortfarande bara de tre kända taggarna -- ingen riktig Git-tagg skapades av någon av PATCH-anropen.
  - **Lärdom för framtida uppdateringar av denna draft**: en PATCH mot `/repos/.../releases/398976758` MÅSTE alltid inkludera `tag_name=v0.3.0` (och gärna `target_commitish`) explicit, annars riskerar draften att tappa sin tilltänkta version igen.
- **Rättelsen (ovan) misslyckades tyst -- upptäckt och korrekt åtgärdad (2026-09-29, samma dag, vid nästa granskning):** `gh api ... -f "body=@/tmp/fil.md"` läste ALDRIG filen -- `gh api`s `-f`-flagga stöder inte `@fil`-syntax för att läsa filinnehåll (det är inte samma sak som `gh release`-kommandonas `-F`/`--notes-file`). Resultatet blev att release-draftens `body` bokstavligen sattes till strängen `"@/tmp/release-body-current.md"` -- inte till det avsedda innehållet.
  - **Varför det inte upptäcktes direkt**: den ursprungliga verifieringen (`grep -c "Breaking changes"` -> `0`) gav en falsk positiv -- söksträngen fanns förvisso inte i body, men det gjorde ingenting annat heller. En ren "innehåller-inte-X"-kontroll är otillräcklig efter en skrivning; en riktig diff mot den avsedda källfilen krävs.
  - **Upptäckt**: vid nästa arbetspass (GDPR-omklassificeringen nedan) hämtades body på nytt för att bygga vidare på den -- då visade sig innehållet vara den trasiga strängen, inte de riktiga release notes.
  - **Korrekt åtgärd denna gång**: hela body (inklusive GDPR-omklassificeringen, se nedan) byggdes som en fullständig, korrekt markdown-fil i scratchpad, paketerades till giltig JSON med `jq -n --rawfile body <fil> '{tag_name:..., target_commitish:..., draft:true, body:$body}'` (undviker alla escaping-problem med citattecken/specialtecken), och skickades med `gh api ... --input <json-fil>` -- samma anrop satte ALLA fyra fälten samtidigt för att undvika den tidigare `tag_name`-bieffekten.
  - **Verifiering denna gång**: en fräsch `GET` direkt efter, `diff` mot den lokala källfilen (identiskt bortsett från en trivial trailing newline), `git ls-remote --tags origin` (samma tre taggar, ingen ny), samt riktade `grep`-kontroller för både frånvaro av det gamla avsnittet och närvaro av det nya GDPR-avsnittet.
  - **Konsekvens**: den tidigare rapporten till Johan om att "release notes är rättade och verifierade" (efter PR #519) var FELAKTIG för själva innehållet -- metadata (`tag_name`, `draft`, `target_commitish`) var korrekt, men `body` var trasigt under hela den perioden. Detta är nu korrigerat och grundligare verifierat.
- **GDPR-omklassificering (2026-09-29, Johans explicita beslut):** GDPR-arbetet (bolagsuppgifter, DPO, DPA, SCC) flyttat från "blockerare inför produktion" till en egen sektion "Framtida krav före användning med riktiga personuppgifter" (se ovan) -- eftersom miljön endast används för kontrollerad Customer Preview med fiktiv testdata, inte skarpa personuppgifter. Ny sektion "Dataklassificering: v0.3.0 är en Customer Preview" tillagd nära dokumentets topp för maximal synlighet. Release-draftens `body` uppdaterad i samma PATCH som body-rättelsen ovan -- innehåller nu en framträdande varningsruta om Customer Preview-status och fiktiv-data-kravet, plus en omformulerad "Framtida krav"-sektion istället för GDPR under "Kända begränsningar".
- **Impeccable PRODUCT.md/DESIGN.md tillagda + ny releasekandidat fastställd och verifierad (2026-09-29):**
  - **Inventering**: tidsstämplar användes för att objektivt skilja mellan filer som faktiskt hör till produkt-/designunderlaget (`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` -- skapade 11:38--11:45) och Impeccable-skillets egen installerade infrastruktur (`.claude/agents/impeccable-*.md`, `.github/agents/`, `.github/hooks/`, `.github/skills/` -- alla exakt 10:58:15, en helt annan kategori, INTE inkluderad i PR:n) samt helt orelaterade, sedan tidigare befintliga ospårade filer (`_bmad-output/`, `_bmad/`, `docs/archive/handoff-production-deploy-gate.md`).
  - **Säkerhetsgranskning**: grep efter secrets/API-nycklar/tokens-mönster, lokala absoluta sökvägar (`/Users/...`), interna Vercel/Supabase-projekt-ID:n och privata URL:er -- inga träffar i någon av de tre filerna.
  - **Faktakontroll mot koden (två avvikelser hittade och korrigerade INNAN commit, inte gömda)**: (1) bokningsstatus-märken i 29 filer använder hårdkodade Tailwind-pastellfärger (`bg-yellow-100 text-yellow-800` osv.), INTE de definierade men helt oanvända `--status-*`-CSS-variablerna i `globals.css` -- DESIGN.md skrevs om för att dokumentera detta ärligt ("The Duplicated Status Rule") istället för att presentera den oanvända tokenuppsättningen som sanning. (2) statusmärkena är 4px-rundade (`rounded`), inte pill-formade (`rounded-full`) som ursprungligen antaget utifrån den generella `<Badge>`-komponenten.
  - **Runtime/build/deploy-kontroll**: `grep` bekräftade att ingen av de tre filerna refereras i `src/`, `next.config.*`, `vercel.json` eller `.github/workflows/` -- noll påverkan på körbar kod.
  - **Känd, icke-blockerande avvikelse**: `docs:validate` flaggar båda `.md`-filerna för att sakna projektets CLAUDE.md-frontmatter-schema (`title`/`category`/`status`/`last_updated`/`sections`) -- förväntat och korrekt, filerna följer istället Impeccable/DESIGN.md-spec:ens egna, fasta, portabla format (ren token-YAML för DESIGN.md, ingen frontmatter alls för PRODUCT.md). `docs:validate` körs varken i CI eller pre-commit/pre-push -- blockerar inte `Quality Gate Passed`.
  - **PR #521 mergad**, ny `main`-HEAD `66fa2360a77f3c23fb1d03deb0b350d972ddc5bc`. En separat, automatiskt triggad "Quality Gates"-körning på `main` (`36552761430`) verifierades grön för exakt denna SHA (samtliga jobb inkl. `Quality Gate Passed`) innan den användes för något. (Denna SHA behandlades vid tillfället felaktigt som en ny produktkandidat -- se rättelsebullet nedan och "Regel: vad flyttar den frysta produktkandidaten" ovan.)
  - **Ny stagingpromotion**: eftersom PR #521 var docs-only triggade push till `main` ingen automatisk Vercel-build (samma "Ignored Build Step"-mönster som tidigare i sprinten). Releasekandidaten force-pushades därför till `preview/candidate` (samma mekanism som Slice 3.1) -> Preview-build `dpl_4xYE4m13ZSmDaeTPRV5dFNTt9T8q` blev `READY` -> Johan körde `vercel promote` i sin egen session (samma mönster som Slice 3.3, agentens auto-mode-klassificerare blockerar detta för agenten) -> ny production-build `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa` för `equinet-staging-app`.
  - **Reducerad rök-verifiering (2026-09-29), alla punkter gröna**: rätt SHA/deployment bekräftat via `list_deployment_aliases` (`equinet-staging.johanlindengard.com` pekar på `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa`) · `GET /api/health` -> `200 OK`, `{"status":"ok","checks":{"database":"connected"}}` · startsida + demo-läge visuellt bekräftat (Playwright-skärmdump, identiskt utseende med tidigare verifiering) · produktion (`equinet-app`) bekräftat oförändrad direkt efteråt, fortfarande `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`/`42842022...`.
  - **Release-draften uppdaterad till ny SHA**: `target_commitish` och de två SHA-referenserna i `body` (Mål-SHA-raden + jämförelselänken) uppdaterade från `4973f6e9...` till `66fa2360...` via samma robusta `jq --rawfile` + `gh api --input`-metod som GDPR-rättelsen, med samma grundliga efterkontroll (diff mot källfil, `tag_name` explicit satt i samma anrop, `git ls-remote --tags` oförändrat). "Rök-verifierad på staging"-påståendet i Mål-SHA-raden korrigerades tillfälligt till "staging-verifiering pågår" under tiden den faktiska rök-verifieringen genomfördes, för att aldrig påstå ett resultat som ännu inte var sant.
- **Rättelse (2026-09-29, samma dag, inom timmar): produktkandidaten återställd till `4973f6e9...`.** Johan fastslog principen i "Regel: vad flyttar den frysta produktkandidaten" ovan -- ren dokumentation/metadata (som Impeccable-filerna) ska aldrig tvinga fram en ny produktkandidat, en ny stagingomgång eller en fullständig rök-verifiering.
  - **Verifiering**: `git diff --name-status 4973f6e9..origin/main` kontrollerad två gånger (före och efter PR #522) -- exakt fyra filer i hela intervallet: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` (nya), `docs/operations/release-sprint-checkpoint.md` (ändrad). Riktad `grep` efter `^src/|^prisma/|^ios/|package(-lock)?\.json|next\.config|vercel\.json|^\.github/workflows/|tsconfig` -- noll träffar, båda gångerna.
  - **Produktkandidaten**: återställd till `4973f6e919339b022425063bd8a280fa2bbe9b41` i denna checkpoint (tabellen ovan) och i release-draftens `target_commitish` + `body` (samma robusta `jq --rawfile` + `gh api --input`-metod, samma grundliga efterkontroll som tidigare rättelser).
  - **Ingen ny stagingdeploy eller rullback utförd**: staging kör fortsatt `66fa2360...` (byggd i den nu ångrade promotionen) -- detta lämnas MEDVETET orört, eftersom källkoden är identisk med produktkandidaten och en ny deploy bara skulle vara ytterligare en onödig operation av samma sort som just konstaterades vara felaktig. Dokumenterat tydligt i "Nuläge (SHA:er)" som en ofarlig avvikelse, inte en okänd risk.
  - **Ingen ny PR för Impeccable-filerna i sig** -- de är redan mergade (PR #521) och förblir på `main`; det som ångras är enbart klassificeringen av dem som "ny produktkandidat", inte deras innehåll.

## Inte gjort

**Historisk sektion -- beskrev läget FÖRE produktionssläppet 2026-09-29.** Se "v0.3.0 ÄR SLÄPPT" högst upp för aktuell status. Tagg (`v0.3.0`), publicerad GitHub Release och produktionsdeploy (`dpl_5v8gEkuRDeg1TmWZBB6CJNuj7Shj`) är alla genomförda och verifierade.

Fortfarande INTE gjort:
- Ingen ytterligare produktionsdeploy utöver denna.
- Releasen är `prerelease: true` -- inte ändrad till en fullständig release.
- Ingen breddning bortom Customer Preview (kräver GDPR-arbetet klart).

## Kända blockerare och återstående slices

**Inga av punkterna nedan är GDPR-relaterade.** GDPR-arbetet är omklassificerat (2026-09-29, Johans beslut) och beskrivs separat under "Framtida krav före användning med riktiga personuppgifter" -- se den sektionen och "Dataklassificering: v0.3.0 är en Customer Preview" ovan. Det är INTE en blockerare för denna release.

- **CHANGELOG.md är INTE uppdaterad** -- `standard-version` har aldrig körts på riktigt, bara `--dry-run`. `package.json`s `version`-fält är fortfarande `0.2.0` trots att `v0.3.0` är taggat och släppt. Kvarstår som en separat, framtida dokumentationsuppgift -- påverkar inte den redan skedda releasen.
- **GitHub Release för v0.3.0 är PUBLICERAD** -- se "v0.3.0 ÄR SLÄPPT" högst upp. Detta var tidigare ett öppet steg, nu genomfört.
- **Vercel-auto-mode-klassificeraren blockerade agentens direkta `request_promote`-anrop** tidigare i sprinten (klassad "Production Deploy"). Det faktiska produktionsdeploy-workflowet (`gh workflow run deploy-production.yml`) blockerades DÄREMOT INTE av klassificeraren -- det är ett GitHub Actions-anrop, inte ett direkt Vercel-verktygsanrop. Framtida Vercel `promote`-operationer (staging eller produktion) kräver fortsatt Johans egen interaktiva session.

## Framtida krav före användning med riktiga personuppgifter

**Detta är INTE en blockerare för v0.3.0 som Customer Preview.** Se "Dataklassificering" ovan för resonemanget. Följande kvarstår orört, som Johans/juridisk rådgivnings beslut, och måste vara löst innan plattformen används med riktiga personuppgifter (dvs. innan en bred, skarp lansering bortom Customer Preview-stadiet):

- **Bolagsuppgifter** -- vem är personuppgiftsansvarig, organisationsform.
- **DPO-bedömning** -- behövs ett dataskyddsombud (Data Protection Officer)?
- **Personuppgiftsbiträdesavtal (DPA)** med underleverantörer som hanterar data (Supabase, Vercel, Stripe, Resend, m.fl.).
- **SCC-status** (Standard Contractual Clauses) för amerikanska underleverantörer.

Nämnt explicit under motsvarande rubrik i v0.3.0-release-utkastets release notes (`id: 398976758`).

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

Slice 3.1, 3.2 och 3.3 är klara. Produktkandidaten är, och förblir, `4973f6e919339b022425063bd8a280fa2bbe9b41` -- se "Regel: vad flyttar den frysta produktkandidaten" för varför senare doc-commits (Impeccable-filerna, PR #521; denna checkpoint-rättelse, PR #522) INTE räknas som nya kandidater. `equinet-staging.johanlindengard.com` (stagingaliaset) kör för närvarande en deployment byggd från `66fa2360...` (en doc-commit) -- källkodsmässigt identisk med produktkandidaten, lämnad orörd med avsikt (se "Nuläge (SHA:er)"). Produktionen (`equinet-app`) är fortfarande helt oförändrad. Workstream 3 (staging av produktkandidaten) är klar.

**Workstream 5/6 är klara** (release notes förberedda, GitHub Release-utkast pekar på produktkandidaten `4973f6e9...` -- se "Verifierat" ovan). **En eventuell produktionsdeploy (Workstream 4, `deploy-production.yml` med `dry_run=false`), publicering av release-utkastet, eller skapande av en riktig Git-tagg kräver alltjämt Johans nya, uttryckliga godkännande i den aktuella sessionen** -- godkännandet av alla tidigare steg gäller INTE automatiskt för dessa nästa steg.

**Status vid denna checkpoint-uppdatering (2026-09-29, efter rättelse i PR #522):**
- Produktkandidat-SHA: `4973f6e919339b022425063bd8a280fa2bbe9b41`, grön `Quality Gate Passed` (se "Nuläge (SHA:er)"). INTE ersatt av något senare -- se "Regel" ovan.
- Rök-verifierad fullständigt på `preview/candidate` + levande stagingalias (Slice 3.2/3.3).
- Stagingaliasets levande deployment: `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa`, SHA `66fa2360...` (doc-commit, källkodsidentisk med produktkandidaten). Rollback-målet är `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL` (produktkandidaten, byggd i Slice 3.3) -- se rollbackplan nedan.
- Produktionens levande deployment (`equinet-app`): fortfarande `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `42842022...` (PR #503) -- oförändrad.
- Testdata från Slice 3.2 är avbokad (status `cancelled`), ingen kvarvarande `pending`/`confirmed`-konflikt i staging-databasen.

### 4. Avvikelser som kräver stopp och nytt beslut

- `main` har fått nya commits sedan senaste läsning av detta dokument, av någon annan än den pågående sessionen.
- Staging- eller produktions-SHA i Vercel matchar inte längre tabellen ovan.
- En `deploy-production.yml`-körning med `dry_run=false` existerar som inte är initierad och godkänd av Johan i den aktuella sessionen.
- `Quality Gate Passed` är rött för den tilltänkta releasekandidat-SHA:n.
- Arbetsytan är inte ren, eller lokal `main` matchar inte `origin/main`.
- Något GDPR-, säkerhets- eller drifts-relaterat fynd som kräver mänsklig bedömning enligt tidigare sprintarbete.

### 5. Åtgärder som ALDRIG får antas vara godkända (fortsatt gällande -- gäller FRAMTIDA sådana åtgärder)

**Uppdatering 2026-09-29:** de tre första punkterna nedan GENOMFÖRDES 2026-09-29, men bara efter Johans nya, uttryckliga, i-sessionen givna godkännande -- se "v0.3.0 ÄR SLÄPPT" högst upp. Detta ÄNDRAR INTE principen: en tidigare given instruktion (eller det faktum att detta redan skett en gång) ger ALDRIG automatiskt tillstånd för NÄSTA produktionsdeploy, tagg eller publicering. Varje framtida sådan åtgärd kräver sitt eget, nytt, uttryckligt godkännande.

- **Produktionsdeploy** (`dry_run=false` i `deploy-production.yml`) -- kräver alltid Johans uttryckliga, aktuella instruktion att deploya en bestämd, verifierad SHA. En tidigare given instruktion gäller INTE automatiskt för en ny SHA. (Genomfört 2026-09-29 för `4973f6e9...`, med godkännande.)
- **Skapande av en riktig Git-tagg** för en release. (Genomfört 2026-09-29: `v0.3.0` på `4973f6e9...`, med godkännande.)
- **Publicering av en GitHub Release** (draft -> published), eller markering som pre-release. (Genomfört 2026-09-29, med godkännande.)
- **Skrivning mot en fjärrdatabas** (staging eller produktion). Fortsatt INTE gjort -- ingen migrering applicerades under produktionsdeployen (se "v0.3.0 ÄR SLÄPPT" -- migrationsavvikelsen var en verifierad no-op, ingen skrivning gjordes).
- **Ändring av produktionskonfiguration** (Vercel-projektinställningar, environment-variabler, `vercel.json`, DNS). Fortsatt INTE gjort.

Att CI är grönt, att en PR är mergad, eller att en tidigare slice/release godkändes, innebär ALDRIG i sig tillstånd för nästa instans av någon av dessa fem åtgärdstyper.

## Rollbackplan för stagingsteget

Gäller Workstream 3 (staging av produktkandidaten). **Status (2026-09-29, efter rättelse i "Regel: vad flyttar den frysta produktkandidaten"): stagingaliaset kör just nu en deployment byggd från en doc-commit (`66fa2360...`), lämnad medvetet orörd eftersom källkoden är identisk med produktkandidaten -- se "Nuläge (SHA:er)". Kedjan av deploymenter, äldst till nyast:**

1. `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8`, SHA `42842022...` (PR #503) -- live innan hela release-sprinten.
2. `dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL`, SHA `4973f6e919339b022425063bd8a280fa2bbe9b41` -- **produktkandidaten sjäv**, live efter Slice 3.3, **nuvarande rollback-mål**.
3. `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa`, SHA `66fa2360a77f3c23fb1d03deb0b350d972ddc5bc` (doc-commit, källkodsidentisk med #2) -- **live nu**, byggd under den sedan ångrade "ny produktkandidat"-tillämpningen (se "Regel" ovan). Lämnas orört -- ingen ny deploy görs bara för att flytta tillbaka till exakt SHA #2, eftersom det inte skulle ändra något körbart.

Alla tre deploymenter finns kvar, inspekterbara, orörda -- bara aliaset har flyttats mellan dem.

**Nuvarande stagingdeployment och alias:**
Deployment-ID `dpl_Fz5Gu3rD3e2UGBs3cm317rQcEBVa`, SHA `66fa2360a77f3c23fb1d03deb0b350d972ddc5bc` (doc-commit, INTE produktkandidaten i sig men källkodsidentisk med den), `equinet-staging.johanlindengard.com`.

**Så här återställs stagingaliaset till föregående kandidat (om en rollback-trigger nedan inträffar):**
`vercel rollback` eller `vercel promote dpl_HSFgtuY6d5kTfjoTVgC2GotHCZkL --scope cola500s-projects` mot `equinet-staging-app` (kräver Johans Vercel-session, samma mönster som redan använts tre gånger i denna sprint -- agentens auto-mode-klassificerare blockerar denna typ av åtgärd för agenten). Vill man gå ännu längre tillbaka, till innan hela release-sprinten: `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8`. Ingen av dessa kommandon rör produktionen (separat Vercel-projekt).

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

## Rollbackplan för produktion

**Status (2026-09-29): AKTIV, inte längre hypotetisk.** Workstream 4 (produktionsdeploy) är genomförd -- `deploy-production.yml` kördes med `dry_run=false` för SHA `4973f6e919339b022425063bd8a280fa2bbe9b41` (körning `36584375136`, success). Se "v0.3.0 ÄR SLÄPPT" högst upp i dokumentet för fullständiga detaljer.

**Nuvarande produktionsdeployment:**
`dpl_5v8gEkuRDeg1TmWZBB6CJNuj7Shj`, SHA `4973f6e919339b022425063bd8a280fa2bbe9b41`, `equinet-app` (target=production), `equinet.johanlindengard.com`.

**Rollback-målet (om en rollback-trigger nedan inträffar):**
Deployment-ID `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa`, SHA `4284202221f07216269659873cacf1f9b9f64f04` (PR #503), `equinet-app` (target=production). Detta är den föregående, tidigare live-deploymenten. Finns kvar, inspekterbar, orörd.

**Så här görs en produktionsrollback:**
`vercel rollback` eller `vercel promote dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa --scope cola500s-projects` mot `equinet-app` (kräver Johans Vercel-session -- agentens auto-mode-klassificerare blockerar denna typ av åtgärd, se Slice 3.3-erfarenheten ovan). Separat Vercel-projekt från staging -- rör aldrig `equinet-staging-app`.

**Databas:** produktionen använder ett helt separat Supabase-projekt (`xybyzflfxnqqyxnvjklv`, Zurich) -- oberoende av stagingens `zzdamokfeenencuggjjp`. Samma migrations-varning som för staging gäller: en Vercel-rollback återställer aldrig databasschemat automatiskt.

## Paus- och återupptagningspunkt: EFTER produktionsrelease (historisk -- steget är genomfört)

**Denna sektion beskrev tidigare en väntpunkt FÖRE produktion. Den är nu historisk.** 2026-09-29 gav Johan uttryckligt godkännande, och release-ready-sprinten slutfördes: produktionsdeploy, tagg `v0.3.0` och publicerad GitHub Release -- se "v0.3.0 ÄR SLÄPPT" högst upp i dokumentet för fullständiga detaljer, verifieringar och länkar.

**Vad som INTE har skett, och som fortfarande kräver separat, ny, uttrycklig instruktion om det blir aktuellt:**
- Ingen ytterligare produktionsdeploy utöver denna.
- Releasen är publicerad men fortfarande markerad `prerelease: true` -- att ändra den till en fullständig, icke-pre-release är ett separat beslut.
- Ingen breddning bortom Customer Preview-stadiet (kräver GDPR-arbetet klart, se "Framtida krav").

En ny session som återupptar arbetet i detta dokument ska läsa "v0.3.0 ÄR SLÄPPT" FÖRST.

**Explicit stopp här.** Följande har INTE skett och ska INTE ske utan att Johan uttryckligen initierar det i en ny, aktuell instruktion:
- Ingen riktig Git-tagg är skapad (verifierat upprepade gånger via `git ls-remote --tags origin`, senast direkt efter SHA-uppdateringen).
- Release-utkastet för v0.3.0 är INTE publicerat (fortfarande `draft: true`).
- `CHANGELOG.md`/`package.json` är INTE uppdaterade -- `standard-version` har enbart körts som `--dry-run`.
- `deploy-production.yml` har aldrig körts med `dry_run=false`.
- Produktionen (`equinet-app`) är fortfarande exakt PR #503, `42842022...` -- bekräftat igen direkt efter den senaste stagingpromotionen.

En ny session som återupptar arbetet ska läsa denna sektion FÖRST och behandla den som den auktoritativa statusen -- inte anta att release-utkastets existens (draft) betyder att publicering eller produktionsdeploy är godkänt.
