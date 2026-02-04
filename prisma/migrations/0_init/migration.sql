-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isManualCustomer" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "city" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "serviceAreaKm" DOUBLE PRECISION DEFAULT 50,
    "serviceArea" TEXT,
    "profileImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recommendedIntervalWeeks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "routeOrderId" TEXT,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Stockholm',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerNotes" TEXT,
    "cancellationMessage" TEXT,
    "horseName" TEXT,
    "horseInfo" TEXT,
    "horseId" TEXT,
    "travelTimeMinutes" INTEGER,
    "isManualBooking" BOOLEAN NOT NULL DEFAULT false,
    "createdByProviderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horse" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "birthYear" INTEGER,
    "color" TEXT,
    "gender" TEXT,
    "specialNeeds" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorsePassportToken" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorsePassportToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "verificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnoxConnection" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FortnoxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
    "fortnoxInvoiceId" TEXT,
    "fortnoxStatus" TEXT,
    "sentToFortnoxAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "providerId" TEXT,
    "announcementType" TEXT NOT NULL DEFAULT 'customer_initiated',
    "serviceType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "numberOfHorses" INTEGER NOT NULL DEFAULT 1,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "specialInstructions" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "routeDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "totalDistanceKm" DOUBLE PRECISION,
    "totalDurationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT,
    "routeOrderId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "locationName" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "estimatedArrival" TIMESTAMP(3),
    "estimatedDurationMin" INTEGER NOT NULL DEFAULT 60,
    "actualArrival" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "problemNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseNote" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderVerification" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuer" TEXT,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBookingRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "providerId" TEXT,
    "locationName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'open',
    "inviteCode" TEXT NOT NULL,
    "joinDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBookingParticipant" (
    "id" TEXT NOT NULL,
    "groupBookingRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "numberOfHorses" INTEGER NOT NULL DEFAULT 1,
    "horseId" TEXT,
    "horseName" TEXT,
    "horseInfo" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'joined',
    "bookingId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBookingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_latitude_longitude_idx" ON "User"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_userId_key" ON "Provider"("userId");

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

-- CreateIndex
CREATE UNIQUE INDEX "Availability_providerId_dayOfWeek_key" ON "Availability"("providerId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityException_providerId_date_idx" ON "AvailabilityException"("providerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_providerId_date_key" ON "AvailabilityException"("providerId", "date");

-- CreateIndex
CREATE INDEX "Booking_providerId_bookingDate_status_idx" ON "Booking"("providerId", "bookingDate", "status");

-- CreateIndex
CREATE INDEX "Booking_customerId_bookingDate_idx" ON "Booking"("customerId", "bookingDate");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Booking_routeOrderId_idx" ON "Booking"("routeOrderId");

-- CreateIndex
CREATE INDEX "Booking_horseId_idx" ON "Booking"("horseId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_providerId_bookingDate_startTime_endTime_key" ON "Booking"("providerId", "bookingDate", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Horse_ownerId_isActive_idx" ON "Horse"("ownerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HorsePassportToken_token_key" ON "HorsePassportToken"("token");

-- CreateIndex
CREATE INDEX "HorsePassportToken_token_idx" ON "HorsePassportToken"("token");

-- CreateIndex
CREATE INDEX "HorsePassportToken_horseId_idx" ON "HorsePassportToken"("horseId");

-- CreateIndex
CREATE INDEX "Upload_userId_idx" ON "Upload"("userId");

-- CreateIndex
CREATE INDEX "Upload_bucket_path_idx" ON "Upload"("bucket", "path");

-- CreateIndex
CREATE INDEX "Upload_verificationId_idx" ON "Upload"("verificationId");

-- CreateIndex
CREATE UNIQUE INDEX "FortnoxConnection_providerId_key" ON "FortnoxConnection"("providerId");

-- CreateIndex
CREATE INDEX "FortnoxConnection_providerId_idx" ON "FortnoxConnection"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

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
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_providerId_createdAt_idx" ON "Review"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");

-- CreateIndex
CREATE INDEX "HorseNote_horseId_noteDate_idx" ON "HorseNote"("horseId", "noteDate");

-- CreateIndex
CREATE INDEX "HorseNote_authorId_idx" ON "HorseNote"("authorId");

-- CreateIndex
CREATE INDEX "ProviderVerification_providerId_status_idx" ON "ProviderVerification"("providerId", "status");

-- CreateIndex
CREATE INDEX "ProviderVerification_status_createdAt_idx" ON "ProviderVerification"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBookingRequest_inviteCode_key" ON "GroupBookingRequest"("inviteCode");

-- CreateIndex
CREATE INDEX "GroupBookingRequest_creatorId_status_idx" ON "GroupBookingRequest"("creatorId", "status");

-- CreateIndex
CREATE INDEX "GroupBookingRequest_status_dateFrom_idx" ON "GroupBookingRequest"("status", "dateFrom");

-- CreateIndex
CREATE INDEX "GroupBookingRequest_inviteCode_idx" ON "GroupBookingRequest"("inviteCode");

-- CreateIndex
CREATE INDEX "GroupBookingRequest_providerId_status_idx" ON "GroupBookingRequest"("providerId", "status");

-- CreateIndex
CREATE INDEX "GroupBookingRequest_latitude_longitude_idx" ON "GroupBookingRequest"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBookingParticipant_bookingId_key" ON "GroupBookingParticipant"("bookingId");

-- CreateIndex
CREATE INDEX "GroupBookingParticipant_groupBookingRequestId_status_idx" ON "GroupBookingParticipant"("groupBookingRequestId", "status");

-- CreateIndex
CREATE INDEX "GroupBookingParticipant_userId_idx" ON "GroupBookingParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBookingParticipant_groupBookingRequestId_userId_key" ON "GroupBookingParticipant"("groupBookingRequestId", "userId");

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_routeOrderId_fkey" FOREIGN KEY ("routeOrderId") REFERENCES "RouteOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByProviderId_fkey" FOREIGN KEY ("createdByProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorsePassportToken" ADD CONSTRAINT "HorsePassportToken_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "ProviderVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnoxConnection" ADD CONSTRAINT "FortnoxConnection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteOrder" ADD CONSTRAINT "RouteOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteOrder" ADD CONSTRAINT "RouteOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeOrderId_fkey" FOREIGN KEY ("routeOrderId") REFERENCES "RouteOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseNote" ADD CONSTRAINT "HorseNote_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseNote" ADD CONSTRAINT "HorseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVerification" ADD CONSTRAINT "ProviderVerification_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingRequest" ADD CONSTRAINT "GroupBookingRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingRequest" ADD CONSTRAINT "GroupBookingRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingParticipant" ADD CONSTRAINT "GroupBookingParticipant_groupBookingRequestId_fkey" FOREIGN KEY ("groupBookingRequestId") REFERENCES "GroupBookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingParticipant" ADD CONSTRAINT "GroupBookingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingParticipant" ADD CONSTRAINT "GroupBookingParticipant_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBookingParticipant" ADD CONSTRAINT "GroupBookingParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

