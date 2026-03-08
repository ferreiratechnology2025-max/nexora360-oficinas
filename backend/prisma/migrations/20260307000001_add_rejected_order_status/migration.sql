-- Add 'rejected' value to OrderStatus enum
-- rejected = client refused the quote on tracking page (different from cancelled = owner cancelled)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'rejected';
