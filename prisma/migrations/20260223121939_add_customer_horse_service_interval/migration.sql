-- CreateTable
CREATE TABLE "CustomerHorseServiceInterval" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "intervalWeeks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerHorseServiceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerHorseServiceInterval_horseId_idx" ON "CustomerHorseServiceInterval"("horseId");

-- CreateIndex
CREATE INDEX "CustomerHorseServiceInterval_serviceId_idx" ON "CustomerHorseServiceInterval"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerHorseServiceInterval_horseId_serviceId_key" ON "CustomerHorseServiceInterval"("horseId", "serviceId");

-- AddForeignKey
ALTER TABLE "CustomerHorseServiceInterval" ADD CONSTRAINT "CustomerHorseServiceInterval_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerHorseServiceInterval" ADD CONSTRAINT "CustomerHorseServiceInterval_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
