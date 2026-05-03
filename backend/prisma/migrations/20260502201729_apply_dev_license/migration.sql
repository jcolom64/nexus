-- AlterTable
ALTER TABLE "system_config" ALTER COLUMN "licenseKey" SET DEFAULT 'NEXUS-DEV-LCNS-LOCAL-DEV-INST-2026',
ALTER COLUMN "plan" SET DEFAULT 'enterprise';

-- Apply the dev license to the existing singleton row. The column-default
-- change only affects new rows; this UPDATE backfills the row that already
-- exists from the prior default.
UPDATE "system_config"
   SET "licenseKey"     = 'NEXUS-DEV-LCNS-LOCAL-DEV-INST-2026',
       "plan"           = 'enterprise',
       "seatsTotal"     = 50,
       "licenseExpires" = ''
 WHERE "id" = 'singleton';
