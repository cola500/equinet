-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingSeriesId" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "maxSeriesOccurrences" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "recurringEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BookingSeries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "horseId" TEXT,
    "intervalWeeks" INTEGER NOT NULL,
    "totalOccurrences" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSeries_customerId_idx" ON "BookingSeries"("customerId");

-- CreateIndex
CREATE INDEX "BookingSeries_providerId_idx" ON "BookingSeries"("providerId");

-- CreateIndex
CREATE INDEX "BookingSeries_status_idx" ON "BookingSeries"("status");

-- CreateIndex
CREATE INDEX "Booking_bookingSeriesId_idx" ON "Booking"("bookingSeriesId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingSeriesId_fkey" FOREIGN KEY ("bookingSeriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
