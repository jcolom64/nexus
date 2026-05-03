-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'EXPORT');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTH', 'USER', 'CONFIG', 'DATA', 'SECURITY');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILED', 'WARNING');

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "action" "AuditAction" NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "source" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_entries_timestamp_idx" ON "audit_entries"("timestamp");

-- CreateIndex
CREATE INDEX "audit_entries_category_idx" ON "audit_entries"("category");

-- CreateIndex
CREATE INDEX "audit_entries_actorEmail_idx" ON "audit_entries"("actorEmail");

-- CreateIndex
CREATE INDEX "audit_entries_action_idx" ON "audit_entries"("action");
