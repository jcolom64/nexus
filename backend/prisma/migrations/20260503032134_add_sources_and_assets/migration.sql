-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('POSTGRES', 'MYSQL', 'MONGODB', 'S3', 'REST_API', 'KAFKA', 'SNOWFLAKE', 'REDIS');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('CONNECTED', 'DEGRADED', 'DISCONNECTED', 'STALE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('TABLE', 'VIEW', 'TOPIC', 'FILE', 'API');

-- CreateEnum
CREATE TYPE "AssetTag" AS ENUM ('PII', 'GDPR', 'SENSITIVE', 'CERTIFIED', 'DEPRECATED', 'GOLDEN');

-- CreateEnum
CREATE TYPE "AssetDomain" AS ENUM ('SALES', 'FINANCE', 'MARKETING', 'PRODUCT', 'COMPLIANCE', 'OPS');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "description" TEXT NOT NULL DEFAULT '',
    "host" TEXT,
    "port" INTEGER,
    "database" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "sizeMb" INTEGER NOT NULL DEFAULT 0,
    "ownerEmail" TEXT,
    "ownerName" TEXT,
    "domain" "AssetDomain" NOT NULL,
    "tags" "AssetTag"[] DEFAULT ARRAY[]::"AssetTag"[],
    "description" TEXT NOT NULL DEFAULT '',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_lineage" (
    "upstreamId" TEXT NOT NULL,
    "downstreamId" TEXT NOT NULL,

    CONSTRAINT "asset_lineage_pkey" PRIMARY KEY ("upstreamId","downstreamId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assets_qualifiedName_key" ON "assets"("qualifiedName");

-- CreateIndex
CREATE INDEX "assets_sourceId_idx" ON "assets"("sourceId");

-- CreateIndex
CREATE INDEX "assets_domain_idx" ON "assets"("domain");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_upstreamId_fkey" FOREIGN KEY ("upstreamId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
