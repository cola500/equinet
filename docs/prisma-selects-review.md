---
title: Prisma named selects -- genomgång
description: Inventering och extrahering av duplicerade select-block i Prisma repositories
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Inventering
  - Vad som extraherades
  - Vad som lämnades inline
  - Framtida användning
---

# Prisma named selects -- genomgång

> Genomförd 2026-03-28. Fokus: PrismaBookingRepository.

---

## Inventering

### Repositories som granskades

| Repository | LOC | Select-block | Duplicering |
|-----------|-----|-------------|-------------|
| PrismaBookingRepository | 851 | 6 stora, 1 liten | Hög -- samma relation-selects 3-6 ggr |
| Övriga repositories | Varierande | 1-2 per fil | Låg -- sällan duplicerade |

**PrismaBookingRepository var den klara kandidaten** -- 6 metoder som returnerar `BookingWithRelations` med liknande relation-selects.

### Dupliceringsanalys i PrismaBookingRepository

| Relation | Varianter | Förekomster | Identiska |
|----------|-----------|-------------|-----------|
| service | 1 | 6 | Alla 6 identiska |
| customer | 2 | 5 | 4 med phone, 1 utan |
| provider | 2 | 5 | 4 basic, 1 med reschedule-settings |
| horse | 2 | 5 | 3 med gender, 2 utan |

---

## Vad som extraherades

6 namngivna select-konstanter i PrismaBookingRepository.ts:

| Konstant | Fält | Ersatte | Användningar |
|----------|------|---------|-------------|
| `SERVICE_SELECT` | name, price, durationMinutes | 6 inline-block | 6 |
| `PROVIDER_SELECT` | businessName, user.{firstName, lastName} | 4 inline-block | 4 |
| `CUSTOMER_CONTACT_SELECT` | firstName, lastName, email, phone | 4 inline-block | 4 |
| `CUSTOMER_EMAIL_SELECT` | firstName, lastName, email | 1 inline-block | 1 |
| `HORSE_FULL_SELECT` | id, name, breed, gender | 3 inline-block | 3 |
| `HORSE_BASIC_SELECT` | id, name, breed | 2 inline-block | 2 |

**Resultat**: -64 rader netto (851 -> 787 LOC). 20 inline-block ersatta med 6 namngivna konstanter.

### Varför just dessa valdes

- **SERVICE_SELECT** (6 ggr identisk): Största vinsten, noll variation
- **PROVIDER_SELECT** (4 ggr identisk): Tydligt mönster, reschedule-varianten behålls inline
- **CUSTOMER_CONTACT_SELECT** (4 ggr identisk): Konsekvent provider-facing mönster
- **CUSTOMER_EMAIL_SELECT** (1 ggr): Bara 1 förekomst men definierad för tydlighet -- visar att varianten utan phone är medveten
- **HORSE_FULL/BASIC_SELECT**: Två tydliga varianter, var och en konsekvent

---

## Vad som medvetet lämnades inline

| Select | Var | Varför inline |
|--------|-----|---------------|
| Provider med reschedule-settings | `findByCustomerIdWithDetails` | Unik variant -- bara customer-vyn behöver reschedule-settings |
| Payment select | `findByProviderIdWithDetails`, `findByCustomerIdWithDetails` | 2 varianter (provider vs customer), bara 1 förekomst vardera |
| CustomerReview select | `findByProviderIdWithDetails` | 1 förekomst |
| Review select | `findByCustomerIdWithDetails` | 1 förekomst |
| Booking core fields | Alla 6 metoder | Subtila skillnader per metod (routeOrderId, isManualBooking etc.) -- inte värt att extrahera |

**Princip**: Extrahera bara select-block som upprepas 3+ gånger identiskt. 1-2 förekomster = inline.

---

## Framtida användning

### Mönstret fungerar bra för:
- **Relation-selects** som upprepas identiskt (service, provider, customer, horse)
- **Repositories med 4+ metoder** som returnerar samma DTO-typ

### Mönstret är inte värt det för:
- **Booking core fields** -- subtila skillnader per metod (vilka fält som behövs varierar)
- **Select-block med 1-2 förekomster** -- ingen redupliceringsvinst
- **Repositories med 1-2 metoder** -- ingen duplicering att eliminera

### Vid nytt fält på relation (t.ex. service.isActive):
1. Ändra relevant named select-konstant (en plats)
2. Alla metoder som använder den får fältet automatiskt
3. Kontrollera att metoder som INTE ska ha fältet använder en annan konstant

### Andra repositories?
Genomgången visade att övriga repositories (Provider, Service, Horse, Follow, etc.) har 1-2 select-block per fil -- inte tillräcklig duplicering för att motivera named selects. **Använd selektivt vid behov, inte som sweep.**
