-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- Seed all 12 feature flags with their default values
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "updatedAt") VALUES
    (gen_random_uuid()::text, 'voice_logging',       true,  NOW()),
    (gen_random_uuid()::text, 'route_planning',      true,  NOW()),
    (gen_random_uuid()::text, 'route_announcements', true,  NOW()),
    (gen_random_uuid()::text, 'customer_insights',   true,  NOW()),
    (gen_random_uuid()::text, 'due_for_service',     true,  NOW()),
    (gen_random_uuid()::text, 'group_bookings',      false, NOW()),
    (gen_random_uuid()::text, 'business_insights',   true,  NOW()),
    (gen_random_uuid()::text, 'self_reschedule',     true,  NOW()),
    (gen_random_uuid()::text, 'recurring_bookings',  false, NOW()),
    (gen_random_uuid()::text, 'offline_mode',        true,  NOW()),
    (gen_random_uuid()::text, 'follow_provider',     false, NOW()),
    (gen_random_uuid()::text, 'municipality_watch',  false, NOW())
ON CONFLICT ("key") DO NOTHING;
