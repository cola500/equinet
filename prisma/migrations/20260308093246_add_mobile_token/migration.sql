-- CreateTable
CREATE TABLE "MobileToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileToken_token_key" ON "MobileToken"("token");

-- CreateIndex
CREATE INDEX "MobileToken_token_idx" ON "MobileToken"("token");

-- CreateIndex
CREATE INDEX "MobileToken_userId_idx" ON "MobileToken"("userId");

-- AddForeignKey
ALTER TABLE "MobileToken" ADD CONSTRAINT "MobileToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
