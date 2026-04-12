---
title: "S21-3: Auth-routes cleanup"
description: "getClientIP, .strict(), RateLimitServiceError 503, Zod pa refreshToken"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Andringar per fil
---

# S21-3: Auth-routes cleanup

## Ändringar per fil

| Fil | getClientIP | .strict() | RateLimitServiceError 503 | Ovrigt |
|-----|-------------|-----------|---------------------------|--------|
| register | Byt till getClientIP | Kolla registerSchema | Lagg till inner try/catch | - |
| resend-verification | OK | Lagg till .strict() | Lagg till inner try/catch | - |
| verify-email | OK | Lagg till .strict() | Redan OK | - |
| forgot-password | OK | Redan OK | Lagg till inner try/catch | - |
| reset-password | OK | Redan OK | Lagg till inner try/catch | - |
| native-session-exchange | OK | Lagg till Zod pa refreshToken | Redan OK | - |

Mekaniska ändringar -- enkel TDD: skriv test for 503 + .strict() rejection, implementera, verify.
