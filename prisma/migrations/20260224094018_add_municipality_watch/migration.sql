-- CreateTable
CREATE TABLE "MunicipalityWatch" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "serviceTypeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MunicipalityWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MunicipalityWatch_municipality_serviceTypeName_idx" ON "MunicipalityWatch"("municipality", "serviceTypeName");

-- CreateIndex
CREATE INDEX "MunicipalityWatch_customerId_idx" ON "MunicipalityWatch"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalityWatch_customerId_municipality_serviceTypeName_key" ON "MunicipalityWatch"("customerId", "municipality", "serviceTypeName");

-- AddForeignKey
ALTER TABLE "MunicipalityWatch" ADD CONSTRAINT "MunicipalityWatch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
