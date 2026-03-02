-- Phase 5: Admin Dashboard
-- Applied via prisma db push — this file exists for historical tracking only.

-- Add lastLoginAt to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- CreateEnum AdminActionType
DO $$ BEGIN
  CREATE TYPE "AdminActionType" AS ENUM ('approve_trial','reject_trial','block_tenant','unblock_tenant','send_message','view_report','other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable PaymentHistory
CREATE TABLE IF NOT EXISTS "PaymentHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'mercadopago',
    "status" TEXT NOT NULL,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminLog
CREATE TABLE IF NOT EXISTS "AdminLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PaymentHistory_tenantId_idx" ON "PaymentHistory"("tenantId");
CREATE INDEX IF NOT EXISTS "PaymentHistory_createdAt_idx" ON "PaymentHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminLog_adminId_idx" ON "AdminLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminLog_targetId_idx" ON "AdminLog"("targetId");

-- Foreign keys
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "PaymentHistory" ADD CONSTRAINT "PaymentHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL;
