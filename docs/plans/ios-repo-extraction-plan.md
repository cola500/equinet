---
title: "Plan: utbrytning av iOS-appen till eget repo (parkerad)"
description: "Parkerad referensplan för en eventuell framtida flytt av ios/ från monorepot till ett separat repo med bevarad historik. Genomförs först när en trigger i ios-api-contract-study.md inträffat och Johan godkänt"
category: plan
status: wip
last_updated: 2026-10-07
tags: [ios, monorepo, git, migration, parked]
depends_on:
  - docs/architecture/ios-api-contract-study.md
related:
  - .claude/rules/commit-strategy.md
sections:
  - Status
  - Underlag 2026-10-07
  - Förutsättningar
  - Migrationssteg
  - Nytt repo från dag ett
  - Ändringar i huvudrepot
  - Rollbackkriterier
  - Godkännanden som krävs
---

# Plan: utbrytning av iOS-appen till eget repo (parkerad)

## Status

**Parkerad. Ingenting av detta är påbörjat.** Beslut 2026-10-07: iOS ligger kvar i monorepot tills minst en trigger inträffar (se [Beslut och triggers](../architecture/ios-api-contract-study.md#beslut-och-triggers)). Planen sparas som referens så att en framtida flytt inte behöver utredas om.

En eventuell flytt ska:

- registrera **exakt checkpoint-SHA** innan något görs,
- skapa ett **Git-bundle som backup**,
- använda en **temporär klon** för historikfiltrering (aldrig omskrivning av `main` i originalrepot),
- köra **secret scan på den filtrerade historiken innan någon push**,
- verifiera **fristående build, tester, auth och API**,
- ha en **parallellperiod med endast en uttalad källa för ändringar**,
- ta bort `ios/` från huvudrepot **först i en separat, reversibel PR**.

## Underlag 2026-10-07

Mät om innan körning; siffrorna föråldras.

- `ios/Equinet/`: 133 spårade filer, 1,2 MB (app 88, tester 26, widget 11, xcodeproj 5, plus `Info.plist`, `EquinetTests.xctestplan`, `EquinetWidgetExtension.entitlements`). SPM: `supabase-swift`, `swift-algorithms`, `swift-argument-parser`. Inga Pods, Fastlane, xcconfig eller Git LFS.
- Historik: 104 av 2 594 commits rör `ios/`; 56 av dem rör även annat (t.ex. #70, #78, #101). Första iOS-commit 2026-03-08 (`4637c5cb`). Inga renames in från utanför `ios/` hittades.
- Författare: två identiteter med samma e-post (`cola500`, `Johan Lindengard`); kan slås ihop med `.mailmap`.
- Tags i originalrepot: `v0.1.0`, `v0.2.0`, `v0.3.0`, `staging-pre-sync-2026-09-26` (webb/staging, ska inte följa med).
- Signering: automatisk, team `H27H3M6Q9H`, bundle `com.equinet.Equinet` (+ `.EquinetWidget`, `.EquinetTests`), app group `group.com.equinet.shared`. Inga Apple-secrets finns i GitHub idag (bara `VERCEL_*`) och ingen release-automation.
- CI: `.github/workflows/ios-tests.yml` (macos-15), path-filter `ios/**`, inte obligatoriskt check på `main` (bara `Quality Gate Passed`).
- Repot är **publikt** i GitHub; synlighet för det nya repot är ett beslut.
- Referenser från huvudrepot till iOS: `.vercelignore`, `tsconfig.typecheck.json`, `.gitignore`, `.husky/pre-push`, scripts (`ios-offline-verification.sh`, `ios-test-cleanup.sh`, `check-reviews-done.sh`, `check-docs-updated.sh`, `generate-metrics.sh`, `equinet-review.py`), `.claude/rules/*` (bl.a. `ios-learnings.md`, `review-matrix.md`), agenten `ios-expert`, `CLAUDE.md`/`README.md`/`AGENTS.md`/`PRODUCT.md` och ca 25 filer under `docs/`.

## Förutsättningar

Börja inte förrän:

1. En trigger enligt studien har inträffat och Johan har beslutat att flytta.
2. Kontraktsgränsen är åtminstone fixture-testad från båda håll och har en versionshandshake (studien, [Rekommenderad kontraktsmodell](../architecture/ios-api-contract-study.md#rekommenderad-kontraktsmodell)). Annars driver webb och app isär utan larm.
3. Widgetfelet och `mobile-token`-resten är åtgärdade (Fynd 1-2 i studien), så att det inte flyttas med.
4. WebView-kopplingen är dokumenterad: appen laddar ca 20 webbvägar och en JS-brygga. Bestäm hur webbändringar som berör dem meddelas mellan repona.

## Migrationssteg

1. **Checkpoint och backup.**
   - Notera exakt SHA på `main` (`git rev-parse HEAD`) och skriv den i plan/PR-beskrivning.
   - `git tag pre-ios-extraction <SHA>` lokalt (pusha inte utan godkännande).
   - `git bundle create ../equinet-pre-ios-extraction.bundle --all` och verifiera med `git bundle verify`.
2. **Temporär klon.** `git clone --no-local <originalrepo> /tmp/equinet-ios-extract`. Originalrepot och dess `main` rörs inte.
3. **Historikfiltrering i klonen** med `git filter-repo` (kräver installation, kräver godkännande). Alternativ: `--subdirectory-filter ios/Equinet` (flyttar Xcode-projektet till repo-roten) eller `--path ios/` om katalogstrukturen ska bevaras. Gör:
   - `--mailmap` för att slå ihop författaridentiteter,
   - `--replace-message` så att `(#NN)` blir `cola500/equinet#NN`,
   - lämna inte med webb-tags.
   Blandade commits behåller bara sin iOS-del; det är väntat.
4. **Granska resultatet.** Antal commits (~104), författare, att inga filer utanför `ios/` finns, att `git log --follow` på några nyckelfiler ser rimlig ut, att repot är litet.
5. **Secret scan på den filtrerade historiken** (t.ex. gitleaks eller trufflehog) **innan någon push**. Notera att `AppConfig.swift` innehåller publika Supabase anon-nycklar och URL:er; bedöm dem medvetet. Åtgärda fynd innan fortsättning.
6. **Lokal fristående verifiering.** Ny checkout, `xcodebuild test` mot samma simulator-/Xcode-version som CI, bygg Debug mot lokal/staging.
7. **Skapa det nya repot** (privat om inget annat beslutas), lägg till remote och pusha den filtrerade historiken (godkännande krävs för skapande och push).
8. **CI i nya repot.** Flytta `ios-tests.yml`, lås Xcode-version (idag väljs senaste `Xcode_*` på macos-15; deployment target är 26.2), gör testjobbet obligatoriskt, verifiera grön körning.
9. **Parallellperiod.** Originalfilerna i `ios/` ligger kvar, **men endast en källa för ändringar är uttalad** (det nya repot) och ändringar i `ios/` i monorepot är förbjudna under perioden (märk i README/CLAUDE.md). Längd: tillräckligt för minst en full kontraktsfixture-körning från båda håll och en verklig iOS-ändring i nya repot.
10. **Funktionskontroll mot backend.** Login (Supabase), `/api/native/*`, session exchange till WebView, push (APNs-topic = bundle-ID), widget, feature-flags, mot lokal, staging och prod.
11. **Separat PR som tar bort `ios/` från huvudrepot** (se nästa avsnitt). Egen branch, eget review, grön `Quality Gate Passed`.
12. **Efterkontroll** och rensa checkpoint-taggen enligt beslut.

## Nytt repo från dag ett

- README med byggguide, Xcode-/Swift-version, miljöer (local/staging/prod) och länk till backend/webbrepot.
- Licens och ägarskap, `CODEOWNERS`, `.gitignore` (inkl. `build/`).
- CI för build + test, obligatoriskt check, branch protection.
- Dependabot för Swift Package Manager och GitHub Actions.
- Dokumenterad API-version/kompatibilitet (min-version, kontraktsfixtures eller länk till dem), och hur webbändringar som berör WebView/brygga meddelas.
- Signering/release: App Store Connect-nyckel och certifikat som GitHub-secrets, aldrig i Git; dokumenterad release- och rollbackprocess (TestFlight -> App Store, förstoppa utrullning).
- Portera `ios-learnings.md`, `ios-expert`-agenten och relevanta delar av review-reglerna.

## Ändringar i huvudrepot

Görs först efter att nya repot är verifierat, i en separat PR:

- Ta bort `ios/`, `.github/workflows/ios-tests.yml`, iOS-scripts, iOS-rader i `.husky/pre-push`, `.vercelignore`, `tsconfig.typecheck.json`, `.gitignore`.
- Uppdatera `CLAUDE.md`, `README.md`, `AGENTS.md`, `PRODUCT.md`, `review-matrix.md` (iOS-raden), `auto-assign.md`, `parallel-sessions.md`, `team-workflow.md`, `code-review-checklist.md` och scripts som nämner iOS.
- Lämna historiska sprint-/retro-dokument orörda men lägg en notis om var koden bor sedan flytten.
- Länka till nya repot från README och CLAUDE.md.
- `v0.3.0` och övriga tags är orörda; flytten gör ingen omskrivning av originalhistoriken.
- iOS-rader i `docs/sprints/backlog.md` flyttas till issues i nya repot; öppna iOS-issues finns inte idag.
- Behåll `src/app/api/native/**` och bryggkoden (`native-bridge.ts`, `useSpeechRecognition.ts`) i huvudrepot: de är backend/webb och ska ha kontraktstester mot nya repots fixtures.

## Rollbackkriterier

Avbryt och återställ (ta bort PR:en, behåll `ios/`, kassera nya repot eller lämna det som kopia) om något av följande inträffar:

- iOS-CI i nya repot går inte grönt efter rimliga åtgärder, eller bygger inte reproducerbart i fristående checkout.
- Auth, session exchange, WebView-brygga, push eller widget fungerar inte mot staging/prod efter flytt.
- Secret scan visar fynd som inte kan åtgärdas utan omskrivning av historiken.
- Kontraktsfixtures går inte att verifiera från båda repona.
- Två källor för ändringar uppstår under parallellperioden (ändringar i både `ios/` och nya repot).
- Efter borttagningen: något i huvudrepots CI, hooks eller docs refererar till borttagna filer och inte kan åtgärdas snabbt. Då revertas borttagnings-PR:en (checkpoint-SHA och bundle finns).

## Godkännanden som krävs

Varje punkt kräver Johans uttryckliga godkännande (inget av detta ingår i förstudien):

1. Själva beslutet att flytta (efter trigger).
2. Installation av `git-filter-repo`.
3. Skapande av nytt repo och val av synlighet.
4. Push av filtrerad historik (efter grön secret scan).
5. Skapande av secrets/signering och ändring av branch protection/required checks.
6. Ändringar av workflows, hooks, `.claude/rules` och agenter.
7. PR:en som tar bort `ios/` från huvudrepot samt dess merge.
