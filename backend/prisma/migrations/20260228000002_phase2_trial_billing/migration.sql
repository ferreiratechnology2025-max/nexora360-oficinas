-- Phase 2: Trial, Billing, Subscription
-- Execute no Supabase SQL Editor

-- Enums
CREATE TYPE "TrialStatus" AS ENUM ('pending_approval','approved','rejected','expired');
CREATE TYPE "TenantStatus" AS ENUM ('pending_approval','trial','active','suspended','rejected');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active','cancelled','past_due','inactive');

-- Alter Tenant
ALTER TABLE "Tenant"
  ADD COLUMN "cnpj"                 TEXT,
  ADD COLUMN "planId"               TEXT,
  ADD COLUMN "status"               "TenantStatus" NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN "registrationIp"       TEXT,
  ADD COLUMN "whatsappInstance"     TEXT,
  ADD COLUMN "trialStatus"          "TrialStatus",
  ADD COLUMN "trialStartedAt"       TIMESTAMP(3),
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "trialRejectionReason" TEXT;

-- Update existing tenants to 'active' so they keep working
UPDATE "Tenant" SET "status" = 'active', "isActive" = true;

-- Unique constraint on CNPJ
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj") WHERE "cnpj" IS NOT NULL;

-- Subscription table
CREATE TABLE "Subscription" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"           TEXT NOT NULL,
  "planId"             TEXT NOT NULL,
  "status"             "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
  "mpSubscriptionId"   TEXT,
  "mpPaymentId"        TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd"   TIMESTAMP(3),
  "pastDueWarningAt"   TIMESTAMP(3),
  "cancelledAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Subscription_planId_fkey"   FOREIGN KEY ("planId")   REFERENCES "Plan"("id");

-- FK Plan → Tenant
ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id");

-- Record migration
INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
VALUES (gen_random_uuid()::text,'manual-phase2',now(),'20260228000002_phase2_trial_billing',NULL,NULL,now(),1);
