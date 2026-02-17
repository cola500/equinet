# Retrospektiv: Bokningspåminnelser (B1)

**Datum:** 2026-02-17
**Scope:** Automatiska e-postpåminnelser 24h före bokningar med opt-out via unsubscribe-länk

---

## Resultat

- 6 ändrade filer, 7 nya filer, 1 ny migration
- 18 nya tester (alla TDD, alla gröna)
- 1833 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma` | `emailRemindersEnabled Boolean @default(true)` på User |
| Migration | `20260217000000_add_email_reminders_enabled` | ALTER TABLE User |
| Domain | `BookingReminderService.ts` | Kärnlogik: findDueReminders (22-30h fönster), sendReminder, processAll |
| Domain | `NotificationService.ts` | Ny typ `REMINDER_BOOKING_24H` |
| Email | `templates.ts` | Ny mall `bookingReminderEmail()` med förberedelsechecklista + unsubscribe-länk |
| Email | `notifications.ts` | Ny `sendBookingReminderNotification()` |
| Email | `unsubscribe-token.ts` | HMAC-SHA256 token (generate, verify, generateUrl) |
| Email | `index.ts` | Nya exports |
| API (Cron) | `api/cron/booking-reminders/route.ts` | Dagligt cron-jobb 06:00 UTC |
| API | `api/email/unsubscribe/route.ts` | GET-endpoint med HMAC-tokenverifiering |
| Config | `vercel.json` | Nytt cron-jobb |
| Tester | 3 testfiler | BookingReminderService (10), cron (4), unsubscribe (4) |

## Vad gick bra

### 1. Mönsteråteranvändning sparade tid
ReminderService-mönstret (dedup via Notification, processAll-loop, error handling) kopierades rakt av till BookingReminderService. Cron-endpoint var identisk med send-reminders. Ingen ny arkitektur behövdes.

### 2. Stateless unsubscribe med HMAC
Istället för att spara tokens i databasen används HMAC-SHA256 med NEXTAUTH_SECRET. Deterministiskt, kryptografiskt säkert, noll DB-overhead. Constant-time jämförelse förhindrar timing attacks.

### 3. TDD fångade mock-problem tidigt
Cron-testet failade först pga arrow function som konstruktor (känt gotcha med `vi.fn().mockImplementation()`). Lösningen med `class`-mönstret var redan dokumenterad i MEMORY.md från Redis-mocken. Snabb fix tack vare tidigare lärdomar.

### 4. Kompakt implementation
Hela featuren (7 nya filer, 6 ändringar, 18 tester) landade på under 30 minuter. Befintlig infrastruktur (Resend, Notification-tabell, cron-mönster) möjliggjorde detta.

## Vad kan förbättras

### 1. Tidsfönster-hantering
22-30h fönstret kompenserar cron-drift men är relativt brett. Om cron missar helt (Vercel-problem) skickas inga påminnelser. Det finns ingen retry-mekanism.

**Prioritet:** LÅG -- Vercel Cron är pålitligt nog för MVP. Retry kan läggas till med QStash vid Pro-plan.

### 2. Ingen testning av unsubscribe-token.ts
Token-hjälpfunktionen har inga egna unit-tester. Den testas indirekt via unsubscribe-endpointet (mockad), men edge cases (tom secret, ogiltig userId) saknar coverage.

**Prioritet:** LÅG -- funktionen är enkel (3 rader HMAC) och testas via integration.

## Patterns att spara

### HMAC-baserad stateless verifiering
```typescript
import { createHmac } from "crypto"
const token = createHmac("sha256", secret).update("prefix:" + id).digest("hex")
```
Återanvändbart för alla "magiska länkar" (unsubscribe, one-click confirm, etc.) utan DB-lagring. Kräver bara en hemlig nyckel och ett prefix per use case.

### Cron med tidsfönster
Istället för exakt tidsmatchning (som kräver minutprecision), använd ett intervall (22-30h). Querya med bred datumfiltrering i DB, filtrera exakt i kod. Gör cron-jobb toleranta för timing-drift.

## Lärandeeffekt

**Nyckelinsikt:** När befintlig infrastruktur (e-postmall, cron-auth, notification-dedup) redan finns på plats kan en komplett feature med TDD, 18 tester och 7 filer byggas på under 30 minuter. Mönsteråteranvändning > innovation.
