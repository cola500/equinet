---
title: "APNs Setup Guide"
description: "Steg-for-steg guide for att konfigurera Apple Push Notification service for Equinet"
category: operations
status: active
last_updated: 2026-04-01
sections:
  - Forutsattningar
  - Steg 1 - Apple Developer Program
  - Steg 2 - Skapa APNs-nyckel
  - Steg 3 - Konfigurera Vercel
  - Steg 4 - Verifiera
  - Felsökning
---

# APNs Setup Guide

Push-notiser i Equinet anvander Apple Push Notification service (APNs) for att skicka notiser till iOS-enheter. Denna guide beskriver hur du konfigurerar APNs-credentials.

## Forutsattningar

- Apple Developer Program-konto (99 USD/ar)
- Tillgang till Vercel-projektet (for env-variabler)
- Bundle ID: `com.equinet.Equinet`

## Steg 1 -- Apple Developer Program

1. Ga till [developer.apple.com](https://developer.apple.com)
2. Logga in med ditt Apple ID
3. Om du inte har ett developer-konto: klicka "Enroll" och folj stegen
4. Betala 99 USD/ar (det tar 24-48h att aktiveras)

## Steg 2 -- Skapa APNs-nyckel

1. Ga till [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
2. Klicka **Keys** i vansterspalten
3. Klicka **+** for att skapa en ny nyckel
4. Ge nyckeln ett namn, t.ex. "Equinet APNs"
5. Kryssa i **Apple Push Notifications service (APNs)**
6. Klicka **Continue** -> **Register**
7. **Ladda ner .p8-filen** (du kan bara ladda ner den EN gang!)
8. Notera **Key ID** (10 tecken, visas pa sidan)

### Hitta Team ID

1. Ga till [Membership](https://developer.apple.com/account#MembershipDetailsCard)
2. Notera **Team ID** (10 tecken)

### Base64-encoda nyckeln

Oppna terminal och kor:

```bash
base64 -i ~/Downloads/AuthKey_XXXXXXXXXX.p8
```

Kopiera hela outputen (en lang rad utan radbrytningar).

## Steg 3 -- Konfigurera Vercel

Lagg till foljande environment variables i Vercel-projektet:

| Variabel | Varde | Exempel |
|----------|-------|---------|
| `APNS_KEY_ID` | Key ID fran steg 2 (10 tecken) | `ABC123DEFG` |
| `APNS_TEAM_ID` | Team ID fran Membership (10 tecken) | `XYZ789ABCD` |
| `APNS_KEY_P8` | Base64-encodad .p8-nyckel | `LS0tLS1CR...` |
| `APNS_BUNDLE_ID` | App bundle identifier | `com.equinet.Equinet` |
| `APNS_PRODUCTION` | `false` for dev/TestFlight, `true` for App Store | `false` |

### Sa har lagger du till i Vercel

1. Ga till [Vercel Dashboard](https://vercel.com) -> Equinet-projektet
2. Klicka **Settings** -> **Environment Variables**
3. Lagg till varje variabel ovan
4. Se till att de galler for ratt miljo (Production/Preview/Development)
5. Deploya om for att tillamppa andringarna

### Lokal utveckling

Lagg aven till variablerna i `.env.local`:

```bash
APNS_KEY_ID=ABC123DEFG
APNS_TEAM_ID=XYZ789ABCD
APNS_KEY_P8=LS0tLS1CR...
APNS_BUNDLE_ID=com.equinet.Equinet
APNS_PRODUCTION=false
```

## Steg 4 -- Verifiera

1. Starta appen pa en fysisk enhet (simulator stodjer inte push)
2. Logga in -- push-permission-dialog ska visas automatiskt
3. Godkann push-notiser
4. Skapa en bokning fran en annan enhet/anvandare
5. Verifiera att leverantoren far en push-notis

### Kontrollera loggar

I Vercel-loggar, sok efter:
- `[push] Sending push to user` -- lyckad leverans
- `[push] APNs 410 Gone` -- ogiltig token (auto-rensas)
- `[push] Feature flag disabled` -- `push_notifications`-flaggan ar av

## Felsökning

| Problem | Orsak | Losning |
|---------|-------|---------|
| Ingen permission-dialog | Appen fragade inte om push | Verifiera att ContentView.onChange triggar PushManager.requestPermission() |
| Dialog visas men ingen push | Token registrerades inte | Kontrollera AppLogger.push-loggar i Xcode, verifiera att /api/device-tokens returnerar 200 |
| 403 fran APNs | Fel credentials | Dubbelkolla APNS_KEY_ID, APNS_TEAM_ID och att .p8-filen ar korrekt base64-encodad |
| Push fungerar i dev men inte prod | Fel environment | Satt `APNS_PRODUCTION=true` for App Store-builds |
| Push till simulator | Stods ej av Apple | Testa pa fysisk enhet |

## Feature flag

Push-notiser ar gatade bakom feature flag `push_notifications` (default: on).
For att stanga av: satt `FEATURE_PUSH_NOTIFICATIONS=false` i `.env` eller toggla i admin-panelen.
