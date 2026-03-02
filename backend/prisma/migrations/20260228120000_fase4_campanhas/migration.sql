-- Phase 4: Growth Engine
-- Applied via prisma db push — this file exists for historical tracking only.

-- CreateEnum
CREATE TYPE IF NOT EXISTS "SegmentType" AS ENUM ('FREQUENT', 'INACTIVE_30', 'INACTIVE_60', 'INACTIVE_90', 'HIGH_VALUE', 'NEW');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "CampaignStatus" AS ENUM ('scheduled', 'sent', 'cancelled');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "CampaignType" AS ENUM ('whatsapp', 'email', 'both');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "MessageType" AS ENUM ('os_notification', 'review', 'upsell', 'reactivation', 'campaign', 'reminder');

-- CreateTable CustomerSegment
CREATE TABLE IF NOT EXISTS "CustomerSegment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "segment" "SegmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReactivationLog
CREATE TABLE IF NOT EXISTS "ReactivationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reactivated" BOOLEAN NOT NULL DEFAULT false,
    "reactivatedAt" TIMESTAMP(3),
    CONSTRAINT "ReactivationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReminderConfig
CREATE TABLE IF NOT EXISTS "ReminderConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "days180Enabled" BOOLEAN NOT NULL DEFAULT true,
    "days365Enabled" BOOLEAN NOT NULL DEFAULT true,
    "days180Message" TEXT,
    "days365Message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable Campaign
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "segment" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'scheduled',
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable UpsellSuggestion
CREATE TABLE IF NOT EXISTS "UpsellSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpsellSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable Review
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable MessageLog
CREATE TABLE IF NOT EXISTS "MessageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSegment_customerId_segment_key" ON "CustomerSegment"("customerId", "segment");
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderConfig_tenantId_key" ON "ReminderConfig"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_orderId_key" ON "Review"("orderId");

-- Indexes
CREATE INDEX IF NOT EXISTS "CustomerSegment_tenantId_segment_idx" ON "CustomerSegment"("tenantId", "segment");
CREATE INDEX IF NOT EXISTS "ReactivationLog_tenantId_idx" ON "ReactivationLog"("tenantId");
CREATE INDEX IF NOT EXISTS "ReactivationLog_customerId_sentAt_idx" ON "ReactivationLog"("customerId", "sentAt");
CREATE INDEX IF NOT EXISTS "Campaign_tenantId_idx" ON "Campaign"("tenantId");
CREATE INDEX IF NOT EXISTS "Campaign_status_scheduledAt_idx" ON "Campaign"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "UpsellSuggestion_tenantId_idx" ON "UpsellSuggestion"("tenantId");
CREATE INDEX IF NOT EXISTS "UpsellSuggestion_customerId_idx" ON "UpsellSuggestion"("customerId");
CREATE INDEX IF NOT EXISTS "Review_tenantId_idx" ON "Review"("tenantId");
CREATE INDEX IF NOT EXISTS "MessageLog_tenantId_customerId_sentAt_idx" ON "MessageLog"("tenantId", "customerId", "sentAt");
CREATE INDEX IF NOT EXISTS "MessageLog_customerId_type_sentAt_idx" ON "MessageLog"("customerId", "type", "sentAt");

-- Foreign keys
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReactivationLog" ADD CONSTRAINT "ReactivationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReactivationLog" ADD CONSTRAINT "ReactivationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellSuggestion" ADD CONSTRAINT "UpsellSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellSuggestion" ADD CONSTRAINT "UpsellSuggestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellSuggestion" ADD CONSTRAINT "UpsellSuggestion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
