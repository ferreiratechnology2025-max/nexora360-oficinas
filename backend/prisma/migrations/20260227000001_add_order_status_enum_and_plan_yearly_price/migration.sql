-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('received', 'diagnosis', 'waiting_approval', 'in_progress', 'testing', 'ready', 'delivered', 'cancelled');

-- AlterTable: convert status column to enum
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'received'::"OrderStatus";

-- AlterTable: add priceYearly to Plan
ALTER TABLE "Plan" ADD COLUMN "priceYearly" DOUBLE PRECISION NOT NULL DEFAULT 0;
