---
title: "Integrationer"
description: "API-dokumentation for Fortnox-integration: OAuth-flode, fakturasynk och konfiguration"
category: api
tags: [api, fortnox, oauth, integration, invoicing]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
sections:
  - Fortnox
  - Konfiguration
---

# Integrationer

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

---

## Fortnox

Fortnox-integrationen gor det mojligt for leverantorer att automatiskt skicka fakturor for genomforda bokningar till sitt Fortnox-konto.

### OAuth-flode

```
1. Leverantor klickar "Koppla Fortnox"
2. GET /api/integrations/fortnox/connect -> Redirect till Fortnox OAuth
3. Anvandare godkanner -> Fortnox redirectar till callback
4. GET /api/integrations/fortnox/callback -> Sparar krypterade tokens
5. Redirect till /provider/settings/integrations?success=true
```

### GET /api/integrations/fortnox/connect

Starta OAuth-flode med Fortnox.

**Auth:** Required (provider)

Endpointen genererar en CSRF-state-token (sparas i httpOnly-cookie, 10 min TTL) och redirectar till Fortnox auktoriseringssida.

**Response:** `302 Redirect` till `https://apps.fortnox.se/oauth-v1/auth?...`

**Felkoder:**
- `403` -- Inte provider
- `503` -- `"Fortnox-integration ar inte konfigurerad"` (saknar env-vars)

> Kraver `FORTNOX_CLIENT_ID` och `FORTNOX_REDIRECT_URI` i miljovariabler.

---

### GET /api/integrations/fortnox/callback

OAuth callback fran Fortnox. Hanteras automatiskt efter auktorisering.

**Auth:** Required (provider)

**Query-parametrar (fran Fortnox):**

| Parameter | Beskrivning |
|-----------|-------------|
| `code` | Auktoriseringskod |
| `state` | CSRF-state-token |
| `error` | Felkod om anvandaren nekade |

**Sakerhetsatgarder:**
- CSRF-validering: `state` matchas mot cookie-varde
- Tokens krypteras med AES-256-GCM fore lagring
- State-cookie rensas efter lyckad callback

**Response:** `302 Redirect` till `/provider/settings/integrations?success=true`

**Felfall (redirect med query-param):**
- `?error=denied` -- Anvandaren nekade
- `?error=missing_params` -- Saknar code eller state
- `?error=state_mismatch` -- CSRF-validering misslyckades (loggas som sakerhetshangelse)
- `?error=token_exchange` -- Kunde inte byta kod mot tokens

---

### POST /api/integrations/fortnox/disconnect

Koppla bort Fortnox-integrationen.

**Auth:** Required (provider)

**Request Body:** Inget

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Felkoder:**
- `403` -- Inte provider
- `404` -- `"Ingen Fortnox-koppling hittad"` eller `"Leverantor hittades inte"`
- `500` -- `"Kunde inte koppla bort Fortnox"`

---

### POST /api/integrations/fortnox/sync

Synka osynkade fakturor till Fortnox. Hittar genomforda bokningar med lyckade betalningar som inte skickats.

**Auth:** Required (provider)
**Rate limiter:** `api` (100/min produktion)

**Request Body:** Inget

**Response:** `200 OK`
```json
{
  "synced": 3,
  "failed": 1,
  "total": 4
}
```

Om inga osynkade bokningar finns:
```json
{
  "synced": 0,
  "message": "Inga osynkade bokningar"
}
```

**Implementation:**
- Hamtar bokningar med `status: "completed"` + `payment.status: "succeeded"` + `payment.fortnoxInvoiceId: null`
- Processar i batchar om max 3 parallellea API-anrop
- Sparar `fortnoxInvoiceId` och `sentToFortnoxAt` i en transaktion
- Delvis lyckad synk ar OK (rapporteras via `synced`/`failed`)

**Felkoder:**
- `403` -- Inte provider
- `404` -- `"Leverantor hittades inte"`
- `429` -- Rate limit
- `500` -- `"Kunde inte synka fakturor"`

---

## Konfiguration

| Miljovariabel | Beskrivning |
|---|---|
| `FORTNOX_CLIENT_ID` | OAuth Client ID |
| `FORTNOX_CLIENT_SECRET` | OAuth Client Secret |
| `FORTNOX_REDIRECT_URI` | Callback-URL (t.ex. `https://equinet.se/api/integrations/fortnox/callback`) |
| `ENCRYPTION_KEY` | AES-256 nyckel for token-kryptering (64 hex-tecken) |

> I utveckling anvands en automatiskt genererad fallback-nyckel for kryptering.

---

*Senast uppdaterad: 2026-02-28*
