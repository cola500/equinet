-- AlterTable: Add updatedAt column with default for existing rows
ALTER TABLE "ProviderCustomerNote" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
