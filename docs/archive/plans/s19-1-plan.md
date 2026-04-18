---
title: "S19-1: Ta bort stripe-payment.spec.ts"
description: "Ta bort E2E-spec som alltid skippas -- Stripe rekommenderar att inte E2E-testa PaymentElement"
category: plan
status: active
last_updated: 2026-04-10
sections:
  - Approach
  - Filer
  - Risker
---

# S19-1: Ta bort stripe-payment.spec.ts

## Approach

1. Verifiera att filen alltid skippas (test.skip)
2. Sök efter referenser till filen i config/docs
3. Ta bort filen
4. Verifiera att full E2E-svit passerar utan regression

## Filer

- **Ta bort:** `e2e/stripe-payment.spec.ts`
- **Eventuellt rensa:** referenser i playwright.config.ts eller docs

## Risker

- Inga -- testet har aldrig körts aktivt
