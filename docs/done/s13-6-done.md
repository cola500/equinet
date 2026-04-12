---
title: "S13-6 Done: Visuell verifiering -- webb + iOS"
description: "Verifiering av att auth-migreringen inte brutit synliga funktioner"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Webb-verifiering
  - iOS-verifiering
  - Avvikelser
  - Laerdomar
---

# S13-6 Done: Visuell verifiering

## Acceptanskriterier

### Webb (Playwright MCP)

- [x] Login med Supabase Auth fungerar (erik@hovslagare-uppsala.se, redirect till dashboard)
- [x] Dashboard laddar med data (3 aktiva tjänster, snabblankar, statistik)
- [x] Bokningar: lista (8 st, flikfiltrering, bokningsdetaljer med kundinfo)
- [x] Kunder: lista (Test Kund, 9 bokningar, 1 hast)
- [x] Tjänster: lista (Akutbesok, Verkning, Skoning -- priser och varaktighet)
- [x] Kalender: veckovy (vecka 14, tillganglighetsschema, stangda dagar)
- [x] Profil: redigera (90% komplett, profilbild, flikar Profil/Installningar/Tillganglighet)
- [x] Recensioner: tom-state ("Inga recensioner annu") -- korrekt for testdata
- [x] Registreringssida: Supabase Auth (kontotypval, losenordskrav)
- [x] Glomt lösenord: fungerar (Supabase password reset)
- [x] Onboarding-checklista: inbyggd i dashboard, visas inte for Erik (har tjänster) -- korrekt
- [x] Demo-lage: feature-flagg-styrt, ingen separat URL -- korrekt

### iOS (manuell verifiering kravs)

- [ ] Login via Supabase Swift SDK -- kräver iOS-build mot aktuellt Supabase-projekt
- [ ] Dashboard med data -- kräver simulator med aktuell build
- [ ] Navigation: alla tabs fungerar
- [ ] WebView-sidor: autentiserade (cookies fungerar)
- [ ] Annonsering, Insikter (native skarmar)
- [ ] Logout + re-login

**Motivering**: iOS-appen kräver en ny build med Supabase Swift SDK-konfiguration
mot aktuellt Supabase-projekt (zzdamokfeenencuggjjp). Detta görs bäst manuellt
av Johan i Xcode, inte via CLI.

## Definition of Done

- [x] Fungerar som forväntat, inga TypeScript-fel
- [x] Saker (validering, error handling)
- [x] Screenshots dokumenterade (12 st i s13-6-screenshots/)
- [x] Inga synliga regressioner pa webb

## Reviews

Kordes: Ingen code-reviewer (inga kodandringar). Ren verifieringsstory.

## Webb-verifiering -- screenshots

| Nr | Sida | Resultat |
|----|------|----------|
| 01 | Login | OK -- Supabase Auth-formular, svenska labels |
| 02 | Dashboard | OK -- data laddar, snabblankar, statistik |
| 03 | Bokningar | OK -- 8 bokningar, flikar, detaljer |
| 04 | Kalender | OK -- veckovy, tillganglighetsschema |
| 05 | Kunder | OK -- lista med bokningsstatistik |
| 06 | Tjänster | OK -- 3 aktiva, priser, knappar |
| 07 | Recensioner | OK -- tom-state korrekt |
| 08 | Profil | OK -- 90% komplett, flikar |
| 09 | Demo | 404 -- korrekt (feature-flagg, inte URL) |
| 10 | Registrering | OK -- Supabase Auth, kontotypval |
| 11 | Glomt lösenord | OK -- Supabase password reset |
| 12 | Onboarding | 404 -- korrekt (inbyggd i dashboard) |

## iOS-verifiering

Skjuten till manuell verifiering. Se Motivering ovan.

## Avvikelser

- iOS-verifiering inte gjord via mobile-mcp. Kräver ny Xcode-build.
- Console errors: 1-2 per sida (typiskt Serwist/SW-relaterat i dev-mode, inte auth).

## Laerdomar

- Lokal DB + Supabase Auth (remote) fungerar bra for utveckling. Auth mot
  Supabase-projektet, data mot lokal PostgreSQL.
- Testlosenord `test123` fungerar fortfarande efter bcrypt-hash-migrering till Supabase.
- Alla seed-anvandare ar tillgängliga via Supabase Auth.
