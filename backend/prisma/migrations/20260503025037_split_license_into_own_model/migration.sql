-- Split licensing fields out of system_config into a dedicated `licenses`
-- singleton table. License is install-time data, written by the
-- `npm run license:apply` CLI; there is no admin-facing PUT/PATCH on it.
-- `seatsUsed` is dropped entirely — the UI now derives in-use seats from
-- the live user count.

-- 1. Create the new table.
CREATE TABLE "licenses" (
    "id"             TEXT             NOT NULL DEFAULT 'singleton',
    "licenseKey"     TEXT             NOT NULL DEFAULT 'NEXUS-DEV-LCNS-LOCAL-DEV-INST-2026',
    "plan"           TEXT             NOT NULL DEFAULT 'enterprise',
    "seatsTotal"     INTEGER          NOT NULL DEFAULT 50,
    "licenseExpires" TEXT             NOT NULL DEFAULT '',
    "appliedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedBy"      TEXT,
    "notes"          TEXT,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- 2. Backfill from system_config so the singleton row carries forward.
INSERT INTO "licenses" ("id", "licenseKey", "plan", "seatsTotal", "licenseExpires", "appliedAt", "appliedBy", "notes")
SELECT
    'singleton',
    "licenseKey",
    "plan",
    "seatsTotal",
    "licenseExpires",
    CURRENT_TIMESTAMP,
    'migration:split_license_into_own_model',
    'Migrated from system_config when license was split into its own model.'
FROM "system_config"
WHERE "id" = 'singleton'
ON CONFLICT ("id") DO NOTHING;

-- 3. Drop the now-redundant columns from system_config (data already
-- copied above).
ALTER TABLE "system_config"
    DROP COLUMN "licenseKey",
    DROP COLUMN "plan",
    DROP COLUMN "seatsUsed",
    DROP COLUMN "seatsTotal",
    DROP COLUMN "licenseExpires";
