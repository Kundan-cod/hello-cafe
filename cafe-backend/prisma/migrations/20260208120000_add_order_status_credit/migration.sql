-- Add CREDIT to OrderStatus enum (PostgreSQL)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CREDIT';
