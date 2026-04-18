---
title: "Kolumn-nivå GRANT + RLS WITH CHECK"
description: "Defense-in-depth-mönster för att begränsa vilka kolumner en klientroll kan uppdatera i PostgreSQL"
category: architecture
status: active
last_updated: 2026-04-18
tags: [security, rls, postgresql, defense-in-depth, supabase]
related:
  - docs/architecture/auth-rls-defense-in-depth-pattern.md
  - docs/architecture/database.md
  - docs/architecture/messaging-domain.md
sections:
  - Problemet
  - Mönstret
  - När använda
  - När INTE använda
  - Implementation
  - Gotchas
  - Referenser
---

# Kolumn-nivå GRANT + RLS WITH CHECK

## Problemet

**PostgreSQL RLS-policies kan inte begränsa vilka kolumner en UPDATE får röra.** En policy som säger "mottagaren kan markera meddelanden som lästa" förhindrar inte en klient från att ändra `content`, `senderId` eller `createdAt` samtidigt — RLS utvärderar bara om raden är åtkomlig, inte vilka fält som uppdateras.

Om applikationskoden är det enda skyddet mot fält-manipulation är det en single point of failure. För defense-in-depth behövs ett andra lager på databas-nivå.

## Mönstret

Kombinera tre lager:

1. **`REVOKE UPDATE` på hela tabellen** för klient-rollen (`authenticated`).
2. **`GRANT UPDATE (kolumn)`** för bara de fält klienten får ändra.
3. **RLS-policy med `USING` + `WITH CHECK`** som begränsar vilka rader klienten får röra.

Första och andra lagret avgörs av PostgreSQL FÖRE RLS utvärderas. Om klienten försöker uppdatera en icke-granted kolumn returneras `permission denied` oavsett RLS.

Prisma (service_role) bypassar både GRANT och RLS. För full defense-in-depth ska repository-lagret explicit begränsa `data:`-objektet i UPDATE-anrop.

## När använda

Applicera mönstret när alla tre gäller:

- **Klientroll har UPDATE-access** till en tabell (Supabase-klient som `authenticated`, inte bara service_role via Prisma).
- **Vissa fält får ändras, andra inte** (typiskt: `readAt`, `status`, `acknowledged` — men inte content eller ägarskap).
- **Konsekvens av manipulation är hög** (innehållsförändring av meddelande, ändra sender-identitet, manipulera tidsstämpel för bevisföring).

Exempel: `Message.readAt` (kund markerar lästa), `Booking.lastViewedAt` (om införs), `Notification.dismissed`.

## När INTE använda

Hoppa över mönstret om något av följande gäller:

- **Bara service_role skriver.** Om all skrivning går via Prisma från servern bypassas RLS och GRANT ändå. Då räcker repository-nivå-begränsning.
- **Hela raden kan skrivas av klienten.** CRUD-endpoints där klienten äger sin egen data och hela objektet uppdateras samtidigt (t.ex. `UserProfile` där användaren själv har full kontroll).
- **Tabellen har ingen RLS alls.** Mönstret är defense-in-depth PÅ RLS, inte ersättning för det.

## Implementation

### 1. REVOKE + GRANT på kolumn-nivå

```sql
-- Återkalla bred UPDATE
REVOKE UPDATE ON public."Message" FROM authenticated;

-- Ge tillbaka på kolumn-nivå
GRANT UPDATE ("readAt") ON public."Message" TO authenticated;
```

Om fler kolumner ska vara uppdaterbara för olika roller — separata GRANT per roll:

```sql
GRANT UPDATE ("readAt") ON public."Message" TO authenticated;
GRANT UPDATE ("content", "readAt", "deletedAt") ON public."Message" TO service_role;
```

### 2. RLS-policy med WITH CHECK

```sql
CREATE POLICY message_recipient_mark_read ON public."Message"
  FOR UPDATE TO authenticated
  USING (
    -- Rad-nivå: bara mottagaren får röra
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  )
  WITH CHECK (
    -- Sama villkor i WITH CHECK skyddar mot att raden flyttas till otillåten ägare
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );
```

**Viktigt:** `USING` = villkor FÖRE uppdatering (vilka rader får ses/röras). `WITH CHECK` = villkor EFTER uppdatering (resultatet måste fortfarande passa policyn). Utan `WITH CHECK` kan en klient teoretiskt skriva om raden till annat ägarskap och "flytta" den ur policyns scope.

### 3. Repository-lagret begränsar `data:`

```ts
// src/infrastructure/persistence/conversation/PrismaConversationRepository.ts
async markMessageAsRead(messageId: string): Promise<void> {
  await this.prisma.message.update({
    where: { id: messageId },
    data: { readAt: new Date() },  // BARA readAt, inget annat
  })
}
```

Prisma bypassar RLS + GRANT (service_role). Repository-nivå-begränsning skyddar mot buggar där fel fält skickas in.

## Gotchas

- **Glömd `WITH CHECK` gör mönstret meningslöst.** Om bara `USING` är satt kan klienten uppdatera raden så att den faller utanför policyn efteråt (ownership transfer).
- **Prisma service_role bypassar allt.** Repository MÅSTE ha explicit `data:`-begränsning. En bugg där `data: { ...req.body }` skickas in förstör skyddet.
- **GRANT är inte idempotent i alla fall.** Att upprepa `GRANT UPDATE (col)` är OK, men `REVOKE` + `GRANT` i migrations måste ordnas noga så de inte krockar med seeding eller rollback.
- **Supabase-klient-fel är tysta.** Felet `permission denied for column` är mindre informativt än RLS-fel. Tester ska verifiera båda lagren separat: "GRANT blockerar content-edit" + "RLS blockerar fel-ägar-scenarios".
- **Rollback-test.** Migrations ska kunna köras framåt OCH bakåt utan att kvarvarande GRANT blir hängande. Skriv alltid rollback-SQL (`GRANT UPDATE ON ... TO authenticated`) i down-migrations.

## Referenser

- **Första användning:** `Message.readAt` i messaging-domän (designad S35-0, implementeras S35-1). Se [messaging-domain.md](./messaging-domain.md#rls-policies).
- **Relaterat mönster:** [auth-rls-defense-in-depth-pattern.md](./auth-rls-defense-in-depth-pattern.md) för kombinationen applikation + RLS.
- **Security-review-fynd:** S35-0 security-reviewer M1 — original-policyn hade bara `USING` utan kolumn-lock, vilket tillät content-manipulation via Supabase-klient.
- **PostgreSQL docs:** [GRANT](https://www.postgresql.org/docs/current/sql-grant.html), [Column-Level Security](https://www.postgresql.org/docs/current/ddl-priv.html).
