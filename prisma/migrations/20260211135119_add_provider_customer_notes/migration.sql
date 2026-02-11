-- AlterTable
ALTER TABLE "HorseProfileToken" RENAME CONSTRAINT "HorsePassportToken_pkey" TO "HorseProfileToken_pkey";

-- CreateTable
CREATE TABLE "ProviderCustomerNote" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCustomerNote_providerId_customerId_createdAt_idx" ON "ProviderCustomerNote"("providerId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCustomerNote_customerId_idx" ON "ProviderCustomerNote"("customerId");

-- RenameForeignKey
ALTER TABLE "HorseProfileToken" RENAME CONSTRAINT "HorsePassportToken_horseId_fkey" TO "HorseProfileToken_horseId_fkey";

-- AddForeignKey
ALTER TABLE "ProviderCustomerNote" ADD CONSTRAINT "ProviderCustomerNote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCustomerNote" ADD CONSTRAINT "ProviderCustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "HorsePassportToken_horseId_idx" RENAME TO "HorseProfileToken_horseId_idx";

-- RenameIndex
ALTER INDEX "HorsePassportToken_token_idx" RENAME TO "HorseProfileToken_token_idx";

-- RenameIndex
ALTER INDEX "HorsePassportToken_token_key" RENAME TO "HorseProfileToken_token_key";
