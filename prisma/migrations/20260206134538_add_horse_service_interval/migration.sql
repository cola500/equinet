-- CreateTable
CREATE TABLE "HorseServiceInterval" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "revisitIntervalWeeks" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorseServiceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorseServiceInterval_providerId_idx" ON "HorseServiceInterval"("providerId");

-- CreateIndex
CREATE INDEX "HorseServiceInterval_horseId_idx" ON "HorseServiceInterval"("horseId");

-- CreateIndex
CREATE UNIQUE INDEX "HorseServiceInterval_horseId_providerId_key" ON "HorseServiceInterval"("horseId", "providerId");

-- AddForeignKey
ALTER TABLE "HorseServiceInterval" ADD CONSTRAINT "HorseServiceInterval_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseServiceInterval" ADD CONSTRAINT "HorseServiceInterval_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
