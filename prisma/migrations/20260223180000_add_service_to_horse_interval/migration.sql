-- Step 1: Add nullable serviceId column + FK
ALTER TABLE "HorseServiceInterval" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "HorseServiceInterval" DROP CONSTRAINT IF EXISTS "HorseServiceInterval_serviceId_fkey";
ALTER TABLE "HorseServiceInterval" ADD CONSTRAINT "HorseServiceInterval_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Drop old unique constraint BEFORE data migration (needed so we can insert per-service rows)
DROP INDEX IF EXISTS "HorseServiceInterval_horseId_providerId_key";

-- Step 3: Data migration - expand existing rows to per-service rows
-- For each existing interval, find distinct services from completed bookings
-- and create a per-service row. Then delete the original (now serviceless) row.
DO $$
DECLARE
  rec RECORD;
  svc RECORD;
  found_service BOOLEAN;
BEGIN
  FOR rec IN SELECT id, "horseId", "providerId", "revisitIntervalWeeks", notes
             FROM "HorseServiceInterval"
             WHERE "serviceId" IS NULL
  LOOP
    found_service := FALSE;
    FOR svc IN SELECT DISTINCT "serviceId"
               FROM "Booking"
               WHERE "horseId" = rec."horseId"
                 AND "providerId" = rec."providerId"
                 AND status = 'completed'
                 AND "serviceId" IS NOT NULL
    LOOP
      found_service := TRUE;
      INSERT INTO "HorseServiceInterval" (id, "horseId", "providerId", "serviceId", "revisitIntervalWeeks", notes, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), rec."horseId", rec."providerId", svc."serviceId", rec."revisitIntervalWeeks", rec.notes, NOW(), NOW());
    END LOOP;

    -- Delete the original row (with NULL serviceId)
    DELETE FROM "HorseServiceInterval" WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 4: Set NOT NULL, add new unique constraint + index
ALTER TABLE "HorseServiceInterval" ALTER COLUMN "serviceId" SET NOT NULL;
CREATE UNIQUE INDEX "HorseServiceInterval_horseId_providerId_serviceId_key" ON "HorseServiceInterval"("horseId", "providerId", "serviceId");
CREATE INDEX IF NOT EXISTS "HorseServiceInterval_serviceId_idx" ON "HorseServiceInterval"("serviceId");
