/*
  Warnings:

  - Added the required column `updatedAt` to the `Availability` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Provider" ADD COLUMN "latitude" REAL;
ALTER TABLE "Provider" ADD COLUMN "longitude" REAL;
ALTER TABLE "Provider" ADD COLUMN "serviceAreaKm" REAL DEFAULT 50;

-- CreateTable
CREATE TABLE "RouteOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "providerId" TEXT,
    "announcementType" TEXT NOT NULL DEFAULT 'customer_initiated',
    "serviceType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "numberOfHorses" INTEGER NOT NULL DEFAULT 1,
    "dateFrom" DATETIME NOT NULL,
    "dateTo" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "specialInstructions" TEXT,
    "contactPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RouteOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RouteOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "routeDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "totalDistanceKm" REAL,
    "totalDurationMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Route_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "routeOrderId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "locationName" TEXT,
    "estimatedArrival" DATETIME,
    "estimatedDurationMin" INTEGER NOT NULL DEFAULT 60,
    "actualArrival" DATETIME,
    "actualDeparture" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "problemNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteStop_routeOrderId_fkey" FOREIGN KEY ("routeOrderId") REFERENCES "RouteOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Availability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Availability" ("dayOfWeek", "endTime", "id", "isActive", "providerId", "startTime") SELECT "dayOfWeek", "endTime", "id", "isActive", "providerId", "startTime" FROM "Availability";
DROP TABLE "Availability";
ALTER TABLE "new_Availability" RENAME TO "Availability";
CREATE UNIQUE INDEX "Availability_providerId_dayOfWeek_key" ON "Availability"("providerId", "dayOfWeek");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RouteOrder_status_serviceType_idx" ON "RouteOrder"("status", "serviceType");

-- CreateIndex
CREATE INDEX "RouteOrder_status_priority_idx" ON "RouteOrder"("status", "priority");

-- CreateIndex
CREATE INDEX "RouteOrder_customerId_status_idx" ON "RouteOrder"("customerId", "status");

-- CreateIndex
CREATE INDEX "RouteOrder_dateFrom_dateTo_status_idx" ON "RouteOrder"("dateFrom", "dateTo", "status");

-- CreateIndex
CREATE INDEX "RouteOrder_providerId_announcementType_status_idx" ON "RouteOrder"("providerId", "announcementType", "status");

-- CreateIndex
CREATE INDEX "RouteOrder_latitude_longitude_announcementType_idx" ON "RouteOrder"("latitude", "longitude", "announcementType");

-- CreateIndex
CREATE INDEX "Route_providerId_routeDate_status_idx" ON "Route"("providerId", "routeDate", "status");

-- CreateIndex
CREATE INDEX "Route_status_idx" ON "Route"("status");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_stopOrder_idx" ON "RouteStop"("routeId", "stopOrder");

-- CreateIndex
CREATE INDEX "RouteStop_routeOrderId_idx" ON "RouteStop"("routeOrderId");

-- CreateIndex
CREATE INDEX "RouteStop_status_idx" ON "RouteStop"("status");

-- CreateIndex
CREATE INDEX "Booking_providerId_bookingDate_status_idx" ON "Booking"("providerId", "bookingDate", "status");

-- CreateIndex
CREATE INDEX "Booking_customerId_bookingDate_idx" ON "Booking"("customerId", "bookingDate");

-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Provider_isActive_createdAt_idx" ON "Provider"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Provider_city_idx" ON "Provider"("city");

-- CreateIndex
CREATE INDEX "Provider_businessName_idx" ON "Provider"("businessName");

-- CreateIndex
CREATE INDEX "Provider_latitude_longitude_idx" ON "Provider"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Service_providerId_isActive_idx" ON "Service"("providerId", "isActive");
