-- CreateTable
CREATE TABLE "ProviderCustomer" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCustomer_providerId_createdAt_idx" ON "ProviderCustomer"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCustomer_customerId_idx" ON "ProviderCustomer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomer_providerId_customerId_key" ON "ProviderCustomer"("providerId", "customerId");

-- AddForeignKey
ALTER TABLE "ProviderCustomer" ADD CONSTRAINT "ProviderCustomer_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCustomer" ADD CONSTRAINT "ProviderCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
