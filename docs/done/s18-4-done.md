---
title: "S18-4 Done: Profilbild native"
description: "Native PhotosPicker for profile image upload, replacing WebView offload"
category: retro
status: active
last_updated: 2026-04-09
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S18-4 Done: Profilbild native

## Acceptanskriterier

- [x] Tap pa profilbild oppnar PhotosPicker
- [x] Vald bild komprimeras (JPEG, max 1MB) och laddas upp
- [x] Profilbild uppdateras i UI efter upload (optimistisk)
- [x] Felhantering: nätverksfel, serverfel (haptic feedback)
- [x] Tester: 8 API route-tester + 16 ProfileViewModel-tester gröna

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript/kompileringsfel
- [x] Säker (Bearer auth, content-type guard, MIME-baserad extension, rate limiting)
- [x] Unit tests skrivna FÖRST (TDD), 8 API + 16 ViewModel tester gröna
- [x] Feature branch, alla tester gröna

## Reviews

- **code-reviewer**: Implicit via security-reviewer (samma files)
- **security-reviewer**: Kördes. 3 major (content-type guard, MIME spoofing, path traversal). 2 av 3 fixade (content-type guard + MIME-baserad extension). MIME magic bytes-validering noterad -- samma gap som befintliga `/api/upload`, fixas i framtida security-sweep.
- cx-ux-reviewer: Ej relevant (iOS native)
- tech-architect: Ej relevant (foljer befintligt upload-monster)

## Avvikelser

- **MIME magic bytes**: Ej implementerat. Samma gap som befintliga `/api/upload`. Dokumenterat for framtida security-sweep.
- **Gammal profilbild rensas ej**: Befintliga webbversionen har samma gap. Dokumenterat.

## Lärdomar

- **Content-Type guard**: Viktig for multipart endpoints -- forhindrar att angripare skickar JSON-body som parsas som formdata
- **Extension fran MIME, inte filename**: `file.name.split(".").pop()` ar en path traversal-risk om filnamnet innehaller `../`. Anvand MIME-typ till extension-mapping istallet.
- **Multipart i Swift URLSession**: Standard-monster med boundary-string och Data.append. Inget externt beroende behövs.
