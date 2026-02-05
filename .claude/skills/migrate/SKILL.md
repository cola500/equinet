---
name: migrate
description: Create a Prisma migration for schema changes
argument-hint: "[description, e.g. add_invoice_table]"
---

Create a Prisma migration for: **$ARGUMENTS**

## Workflow

### 1. Edit the schema

Open `prisma/schema.prisma` and make the necessary changes.

**Reminders:**
- Add indexes on fields you filter, sort, or search on (Gotcha #8)
- Use `@db.Date` for date-only fields (and remember UTC parsing - Gotcha #14)
- Add `@@index` for foreign keys + common filter combinations

### 2. Create the migration

```bash
npx prisma migrate dev --name $ARGUMENTS
```

This will:
- Generate a SQL migration file in `prisma/migrations/`
- Apply it to your local database
- Regenerate the Prisma client

### 3. Verify

```bash
npx prisma studio
```

Check that the new table/columns look correct.

### 4. Stage the migration files

The migration files in `prisma/migrations/` MUST be committed:

```bash
git add prisma/schema.prisma prisma/migrations/
```

## Important rules

- **NEVER use `prisma db push`** for anything other than throwaway prototyping
- **Always commit migration files** - they're needed for production deploy (`prisma migrate deploy`)
- **Migration names** should be descriptive: `add_invoice_table`, `add_status_to_booking`, `remove_legacy_fields`
- **`prisma migrate reset`** drops ALL data and reruns all migrations + seed - use with caution
- **Prisma `$transaction`** requires `@ts-expect-error` due to known TS inference issues

## Common patterns

**Add a new field:**
```prisma
model Booking {
  // ... existing fields
  cancelledAt DateTime?  // Optional = nullable, no migration issues
}
```

**Add a required field to existing table:**
```prisma
// Must provide a default, or migration will fail if rows exist
model Booking {
  priority Int @default(0)
}
```

**Add a relation:**
```prisma
model Invoice {
  id        String   @id @default(uuid())
  booking   Booking  @relation(fields: [bookingId], references: [id])
  bookingId String

  @@index([bookingId])  // Always index foreign keys!
}
```
