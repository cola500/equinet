-- CreateTable
CREATE TABLE "CustomerInviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByProviderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInviteToken_token_key" ON "CustomerInviteToken"("token");

-- CreateIndex
CREATE INDEX "CustomerInviteToken_token_idx" ON "CustomerInviteToken"("token");

-- CreateIndex
CREATE INDEX "CustomerInviteToken_userId_idx" ON "CustomerInviteToken"("userId");

-- AddForeignKey
ALTER TABLE "CustomerInviteToken" ADD CONSTRAINT "CustomerInviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInviteToken" ADD CONSTRAINT "CustomerInviteToken_invitedByProviderId_fkey" FOREIGN KEY ("invitedByProviderId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
