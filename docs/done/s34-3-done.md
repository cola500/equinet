---
title: "S34-3 Done: Felmeddelanden -- nätverks- vs autentiseringsfel"
description: "AuthError-enum + mapURLError + loginErrorType + NativeLoginView ikon per feltyp"
category: plan
status: archived
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Lärdomar
---

# S34-3 Done

## Acceptanskriterier

- [x] LoginError-enum definierad med 4 kategorier (invalidCredentials, networkUnavailable, serverError, unknown)
- [x] URLError + HTTP-status mappat till rätt kategori via mapURLError + mapSupabaseAuthError
- [x] NativeLoginView visar differentierat meddelande + ikon per feltyp
- [x] 4 nya AuthManagerTests gröna (11/11 total)

## Definition of Done

- [x] Inga kompileringsfel (BUILD SUCCEEDED)
- [x] Säker (ingen ny API-yta, auth-logik oförändrad)
- [x] Tester skrivna FÖRE implementation (TDD): 4 RED → GREEN
- [x] Feature branch, tester gröna

## Reviews körda

- [x] code-reviewer: Inga blockers/majors. Minors fixade:
  - `sessionMissing` → `.serverError` (var `.invalidCredentials` -- semantiskt fel)
  - `userBanned` → `.serverError` (adminbeslut, inte fel credentials)
  - Känd begränsning: `emailNotConfirmed` ger fortfarande "E-post eller lösenord stämmer inte" -- behöver eget LoginError-fall i framtiden

## Docs uppdaterade

Ingen docs-uppdatering (intern iOS auth-förbättring, ej synlig i hjälpartiklar -- felmeddelanden är inloggningssidan).

## Verktyg använda

- Läste patterns.md vid planering: nej (N/A -- iOS error-mapping)
- Kollade code-map.md: nej (visste redan)
- Hittade matchande pattern? Nej

## Modell

claude-sonnet-4-6

## Lärdomar

- **URLError-catch FÖRE generic catch**: I Swift fångas `URLError` av `catch { ... }` om specifik `catch let urlError as URLError` inte kommer FÖRST. Ordningen är kritisk.
- **LoginError.message som computed property**: Att lägga message och icon på enumet självt undviker att sprida UI-logik till AuthManager. Enumet bär sina egna presentationsdata.
- **`cancelled` URLError inkludering**: Sprint-spec valde att mappa `.cancelled` till `.networkUnavailable`. Kod-reviewer noterade att `.cancelled` kan triggas av app-navigering (inte nätverksproblem). Om vi vill skilja dem åt krävs ett `requestCancelled`-fall eller att `.cancelled` → `.unknown`.
- **emailNotConfirmed-begränsning**: Meddelandena i `LoginError` är fasta per fall. `emailNotConfirmed` behöver tekniskt sett ett eget enum-fall för att ge rätt meddelande ("Verifiera din e-post"). Lämplig framtida förbättring.
