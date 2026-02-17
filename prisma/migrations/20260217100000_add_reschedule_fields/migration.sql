-- AlterTable: Add reschedule settings to Provider
ALTER TABLE "Provider" ADD COLUMN "rescheduleEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Provider" ADD COLUMN "rescheduleWindowHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Provider" ADD COLUMN "maxReschedules" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Provider" ADD COLUMN "rescheduleRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add rescheduleCount to Booking
ALTER TABLE "Booking" ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0;
