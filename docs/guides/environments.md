---
title: "Miljöer — lokal, staging, produktion"
description: "URL-matris, .env-hierarki, iOS-scheman och Vercel-konfiguration per miljö"
category: guide
status: active
last_updated: 2026-04-20
sections:
  - Miljömatris
  - env-hierarki
  - iOS-scheman
  - Staging-deployment
  - Vanliga gotchas
---

# Miljöer — lokal, staging, produktion

## Miljömatris

| Miljö | Webb-URL | Supabase-projekt | Auth-källa | Trigger |
|-------|----------|-----------------|------------|---------|
| **Lokal** | `http://localhost:3000` | Lokal (`127.0.0.1:54321`) | Supabase CLI | `npm run dev` |
| **Staging** | `https://equinet-git-staging-cola500.vercel.app` | `zzdamokfeenencuggjjp` (remote) | Supabase hosted | Push till `staging`-branch |
| **Produktion** | `https://equinet-app.vercel.app` | `zzdamokfeenencuggjjp` (remote) | Supabase hosted | Push till `main`-branch |

> Staging och produktion delar Supabase-projekt tills ett separat prod-projekt skapas.

## .env-hierarki

Next.js läser miljövariabler i denna prioritetsordning (högst överst):

```
.env.local          ← TRUMFAR ALLT. Vercel CLI skriver hit med vercel env pull.
.env.development    ← Endast i dev-läge. Aldrig i CI.
.env                ← Standard. Committad version är .env.example.
```

**Regel:** `.env.local` är gitignorerad och lokal. Sätt lokala overrides där.

### VARNING: vercel env pull

`vercel env pull` skapar `.env.local` med **produktionsnycklar** (remote `DATABASE_URL`).
Om du råkat köra detta: kommentera bort `DATABASE_URL` i `.env.local` för lokal dev.

Se även: [gotchas.md #23](gotchas.md#23-vercel-env-pull-overskrider-lokal-config)

## iOS-scheman

iOS-appen (Swift) väljer miljö via `AppEnvironment` i `AppConfig.swift`:

| Schema | Trigger | Webb-URL | Supabase |
|--------|---------|----------|----------|
| **Local** (DEBUG, default) | Bygg i Xcode | `http://localhost:3000` | `127.0.0.1:54321` |
| **Staging** (DEBUG + `-STAGING`) | Launch arg `-STAGING` | `https://equinet-git-staging-cola500.vercel.app` | `zzdamokfeenencuggjjp` |
| **Production** (RELEASE) | Archive-build | `https://equinet-app.vercel.app` | `zzdamokfeenencuggjjp` |

**Sätta staging i Xcode:**
Product → Scheme → Edit Scheme → Run → Arguments → Lägg till `-STAGING`

**Sätta staging via CLI (simulator):**
```bash
xcrun simctl launch <UDID> com.equinet.Equinet -STAGING
```

## Staging-deployment

Staging-branchen `staging` deployas automatiskt av Vercel vid varje push.
URL-mönster: `equinet-git-staging-cola500.vercel.app` (stabil per branch, inte per commit).

**Deploytrigger:**
```bash
git checkout staging
git merge main         # Synka från main
git push origin staging
# Vercel deployas automatiskt ~1 min
```

**Miljövariabler på Vercel:**
- Staging och produktion delar Project Settings → Environment Variables
- Separata värden per miljö konfigureras i Vercel-dashboard (Preview vs Production)

## Vanliga gotchas

### `npm run status` visar "remote" vid lokal dev

`vercel env pull` skapade `.env.local` med remote `DATABASE_URL`. Lösning:
1. Öppna `.env.local`
2. Kommentera bort `DATABASE_URL`-raden
3. Kör `npm run status` igen — ska nu visa "lokal"

### iOS kör mot fel backend

Kontrollera launch arguments. Default (DEBUG utan `-STAGING`) = localhost.
Om du testar på fysisk enhet utan lokal server: lägg till `-STAGING`.

### Supabase CLI lokala nycklar

`supabase start` genererar standardnycklar (publikt kända demo-nycklar).
De är desamma för alla Supabase CLI-installationer — **inte hemliga för lokal dev**.
Remote-nycklar är hemliga och ska aldrig committas.
