-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_createdByProviderId_idx" ON "Booking"("createdByProviderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GroupBookingParticipant_horseId_idx" ON "GroupBookingParticipant"("horseId");
