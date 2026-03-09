-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "stableId" TEXT;

-- CreateTable
CREATE TABLE "Stable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "municipality" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "profileImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StableSpot" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "pricePerMonth" DOUBLE PRECISION,
    "availableFrom" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StableSpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StableInviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StableInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stable_userId_key" ON "Stable"("userId");

-- CreateIndex
CREATE INDEX "Stable_municipality_isActive_idx" ON "Stable"("municipality", "isActive");

-- CreateIndex
CREATE INDEX "Stable_latitude_longitude_idx" ON "Stable"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Stable_isActive_createdAt_idx" ON "Stable"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "StableSpot_stableId_status_idx" ON "StableSpot"("stableId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StableInviteToken_token_key" ON "StableInviteToken"("token");

-- CreateIndex
CREATE INDEX "StableInviteToken_token_idx" ON "StableInviteToken"("token");

-- CreateIndex
CREATE INDEX "StableInviteToken_stableId_idx" ON "StableInviteToken"("stableId");

-- CreateIndex
CREATE INDEX "Horse_stableId_idx" ON "Horse"("stableId");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "Stable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stable" ADD CONSTRAINT "Stable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StableSpot" ADD CONSTRAINT "StableSpot_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "Stable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StableInviteToken" ADD CONSTRAINT "StableInviteToken_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "Stable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
