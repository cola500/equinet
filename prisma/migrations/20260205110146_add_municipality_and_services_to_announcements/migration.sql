-- AlterTable
ALTER TABLE "RouteOrder" ADD COLUMN     "municipality" TEXT;

-- CreateTable
CREATE TABLE "_RouteOrderToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RouteOrderToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RouteOrderToService_B_index" ON "_RouteOrderToService"("B");

-- CreateIndex
CREATE INDEX "RouteOrder_municipality_announcementType_status_idx" ON "RouteOrder"("municipality", "announcementType", "status");

-- AddForeignKey
ALTER TABLE "_RouteOrderToService" ADD CONSTRAINT "_RouteOrderToService_A_fkey" FOREIGN KEY ("A") REFERENCES "RouteOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RouteOrderToService" ADD CONSTRAINT "_RouteOrderToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
