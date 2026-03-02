-- ============================================================
-- Nexora360 Oficina — Setup completo do banco
-- Cole e execute no Supabase SQL Editor
-- ============================================================

-- 1. ENUM OrderStatus
CREATE TYPE "OrderStatus" AS ENUM (
  'received',
  'diagnosis',
  'waiting_approval',
  'in_progress',
  'testing',
  'ready',
  'delivered',
  'cancelled'
);

-- 2. TABELA Tenant
CREATE TABLE "Tenant" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "nome"            TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "password"        TEXT NOT NULL,
  "phone"           TEXT,
  "slug"            TEXT NOT NULL,
  "plano"           TEXT NOT NULL DEFAULT 'basic',
  "limiteMensagens" INTEGER NOT NULL DEFAULT 500,
  "mensagensUsadas" INTEGER NOT NULL DEFAULT 0,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- 3. TABELA User
CREATE TABLE "User" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "password"       TEXT NOT NULL,
  "phone"          TEXT,
  "role"           TEXT NOT NULL DEFAULT 'mechanic',
  "commissionRate" DOUBLE PRECISION,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 4. TABELA Customer
CREATE TABLE "Customer" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "email"        TEXT,
  "phone"        TEXT NOT NULL,
  "cpf"          TEXT,
  "address"      TEXT,
  "number"       TEXT,
  "neighborhood" TEXT,
  "city"         TEXT,
  "state"        TEXT,
  "zipCode"      TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Customer_cpf_key" ON "Customer"("cpf");

-- 5. TABELA Vehicle
CREATE TABLE "Vehicle" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "brand"      TEXT NOT NULL,
  "model"      TEXT NOT NULL,
  "year"       INTEGER,
  "plate"      TEXT NOT NULL,
  "color"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- 6. TABELA Order
CREATE TABLE "Order" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"           TEXT NOT NULL,
  "customerId"         TEXT NOT NULL,
  "vehicleId"          TEXT NOT NULL,
  "mechanicId"         TEXT,
  "orderNumber"        TEXT NOT NULL,
  "problemDescription" TEXT,
  "laborValue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "partsValue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalValue"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedDays"      INTEGER NOT NULL DEFAULT 5,
  "estimatedCompletion" TIMESTAMP(3),
  "status"             "OrderStatus" NOT NULL DEFAULT 'received',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"        TIMESTAMP(3),
  "deliveredAt"        TIMESTAMP(3),
  "trackingToken"      TEXT NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");

-- 7. TABELA File
CREATE TABLE "File" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileName"     TEXT NOT NULL,
  "path"         TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "orderId"      TEXT,
  "description"  TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- 8. TABELA WhatsAppMessage
CREATE TABLE "WhatsAppMessage" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "orderId"     TEXT,
  "phone"       TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "messageId"   TEXT,
  "instanceId"  TEXT,
  "mediaUrl"    TEXT,
  "sentAt"      TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt"      TIMESTAMP(3),
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsAppMessage_tenantId_idx" ON "WhatsAppMessage"("tenantId");
CREATE INDEX "WhatsAppMessage_phone_idx" ON "WhatsAppMessage"("phone");

-- 9. TABELA EmailLog
CREATE TABLE "EmailLog" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "to"        TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "sentAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- 10. TABELA Plan
CREATE TABLE "Plan" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "displayName"  TEXT NOT NULL,
  "priceMonthly" DOUBLE PRECISION NOT NULL,
  "priceYearly"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "messageLimit" INTEGER NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- 11. FOREIGN KEYS
ALTER TABLE "User"            ADD CONSTRAINT "User_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Customer"        ADD CONSTRAINT "Customer_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Vehicle"         ADD CONSTRAINT "Vehicle_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Vehicle"         ADD CONSTRAINT "Vehicle_customerId_fkey"       FOREIGN KEY ("customerId") REFERENCES "Customer"("id");
ALTER TABLE "Order"           ADD CONSTRAINT "Order_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Order"           ADD CONSTRAINT "Order_customerId_fkey"         FOREIGN KEY ("customerId") REFERENCES "Customer"("id");
ALTER TABLE "Order"           ADD CONSTRAINT "Order_vehicleId_fkey"          FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id");
ALTER TABLE "Order"           ADD CONSTRAINT "Order_mechanicId_fkey"         FOREIGN KEY ("mechanicId") REFERENCES "User"("id");
ALTER TABLE "File"            ADD CONSTRAINT "File_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "File"            ADD CONSTRAINT "File_orderId_fkey"             FOREIGN KEY ("orderId") REFERENCES "Order"("id");
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id");
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_orderId_fkey"  FOREIGN KEY ("orderId") REFERENCES "Order"("id");
ALTER TABLE "EmailLog"        ADD CONSTRAINT "EmailLog_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- 12. TABELA de controle de migrations do Prisma
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                TEXT NOT NULL,
  "checksum"          TEXT NOT NULL,
  "finished_at"       TIMESTAMPTZ,
  "migration_name"    TEXT NOT NULL,
  "logs"              TEXT,
  "rolled_back_at"    TIMESTAMPTZ,
  "started_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual-setup',
  now(),
  '20260227000001_add_order_status_enum_and_plan_yearly_price',
  NULL, NULL, now(), 1
);

-- ============================================================
-- SEED — 3 planos Nexora360
-- ============================================================
INSERT INTO "Plan" ("id","name","displayName","priceMonthly","priceYearly","messageLimit","isActive")
VALUES
  (gen_random_uuid()::text, 'starter',      'Starter',      297.0, 2970.0,  500,   true),
  (gen_random_uuid()::text, 'profissional', 'Profissional', 597.0, 5970.0,  2000,  true),
  (gen_random_uuid()::text, 'elite',        'Elite',        997.0, 9970.0,  10000, true)
ON CONFLICT ("name") DO UPDATE
  SET "priceMonthly" = EXCLUDED."priceMonthly",
      "priceYearly"  = EXCLUDED."priceYearly",
      "messageLimit" = EXCLUDED."messageLimit";

-- SEED — Tenant + Admin demo
INSERT INTO "Tenant" ("id","nome","email","password","phone","slug","plano","limiteMensagens","mensagensUsadas")
VALUES (
  'demo-tenant-nexora-00000001',
  'Nexora Demo',
  'admin@nexora360.com',
  '$2b$10$rOzJqQ1K5v6P3mX8nY2LqeN0k9P7s4R1mC8jH3fT5bV6wA2dE1gKu',
  '11999999999',
  'nexora-demo',
  'starter',
  500,
  0
) ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "User" ("id","tenantId","name","email","password","phone","role")
VALUES (
  'demo-user-admin-000000001',
  'demo-tenant-nexora-00000001',
  'Admin',
  'admin@nexora360.com',
  '$2b$10$rOzJqQ1K5v6P3mX8nY2LqeN0k9P7s4R1mC8jH3fT5bV6wA2dE1gKu',
  '11999999999',
  'owner'
) ON CONFLICT ("email") DO NOTHING;

-- Senha do admin demo: admin123
