-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('NEW', 'INVESTIGATING', 'PLANNED', 'FIXED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BugReportPriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reproductionSteps" TEXT,
    "pageUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "userRole" TEXT NOT NULL,
    "status" "BugReportStatus" NOT NULL DEFAULT 'NEW',
    "priority" "BugReportPriority" NOT NULL DEFAULT 'P2',
    "internalNote" TEXT,
    "userId" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_priority_idx" ON "BugReport"("priority");

-- CreateIndex
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
