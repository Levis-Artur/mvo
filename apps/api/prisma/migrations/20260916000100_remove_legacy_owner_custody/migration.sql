-- Fail closed: no records or removed-column values are rewritten or deleted.
BEGIN;

-- Hold the same locks through guards and DDL to prevent concurrent legacy writes.
LOCK TABLE "CustodyBalance", "StockDocument", "StockTransaction", "StockDocumentLine"
  IN ACCESS EXCLUSIVE MODE;

DO $guards$
BEGIN
  IF EXISTS (SELECT 1 FROM "CustodyBalance") THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: CustodyBalance must be empty.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "StockDocument" WHERE "type"::text IN ('TRANSFER', 'ASSIGNMENT')
  ) THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: StockDocument contains TRANSFER/ASSIGNMENT.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "StockDocument" WHERE "accountingModel"::text = 'OWNER_CUSTODY'
  ) THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: StockDocument contains OWNER_CUSTODY.';
  END IF;
  -- Reject every removed transaction value; text comparison also defensively
  -- covers ASSIGNMENT_IN/OUT, which are absent from the repository enum.
  IF EXISTS (
    SELECT 1 FROM "StockTransaction"
    WHERE "type"::text IN (
      'TRANSFER_IN', 'TRANSFER_OUT', 'ISSUE',
      'TRANSFER_REVERSAL_OUT', 'TRANSFER_REVERSAL_IN',
      'ASSIGNMENT_OUT_DIRECT', 'ASSIGNMENT_OUT_CUSTODY',
      'ASSIGNMENT_IN_DIRECT', 'ASSIGNMENT_IN_CUSTODY',
      'ISSUE_FROM_DIRECT', 'ISSUE_FROM_CUSTODY', 'ASSIGNMENT_REVERSAL',
      'ASSIGNMENT_IN', 'ASSIGNMENT_OUT'
    )
  ) THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: StockTransaction contains removed legacy types.';
  END IF;
  -- Both accountingModel columns must be convertible without remapping data.
  IF EXISTS (
    SELECT 1 FROM "StockDocument"
    WHERE "accountingModel" IS NOT NULL AND "accountingModel"::text <> 'DIRECT_BALANCE'
  ) OR EXISTS (
    SELECT 1 FROM "StockTransaction"
    WHERE "accountingModel" IS NOT NULL AND "accountingModel"::text <> 'DIRECT_BALANCE'
  ) THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: accountingModel contains LEGACY_BALANCE/OWNER_CUSTODY; no automatic conversion is allowed.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "StockDocumentLine" WHERE "sourceCustodyBalanceId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Legacy custody cleanup aborted: sourceCustodyBalanceId must be NULL.';
  END IF;
END
$guards$;

-- Remove the only incoming custody FK explicitly, then its column/index.
ALTER TABLE "StockDocumentLine"
  DROP CONSTRAINT "StockDocumentLine_sourceCustodyBalanceId_fkey";
DROP INDEX "StockDocumentLine_sourceCustodyBalanceId_idx";
ALTER TABLE "StockDocumentLine" DROP COLUMN "sourceCustodyBalanceId";
DROP TABLE "CustodyBalance";

-- These enum columns have no defaults or enum-dependent CHECK/partial indexes
-- in the migration history. PostgreSQL rebuilds their ordinary indexes during
-- ALTER TYPE; unrelated constraints/indexes/triggers remain unchanged.
-- Unexpected dependencies fail at restrictive DROP TYPE and roll back all DDL.
CREATE TYPE "StockDocumentType_new" AS ENUM ('MVO_TRANSFER', 'ISSUE');
ALTER TABLE "StockDocument" ALTER COLUMN "type" TYPE "StockDocumentType_new"
  USING ("type"::text::"StockDocumentType_new");
DROP TYPE "StockDocumentType";
ALTER TYPE "StockDocumentType_new" RENAME TO "StockDocumentType";

CREATE TYPE "StockAccountingModel_new" AS ENUM ('DIRECT_BALANCE');
ALTER TABLE "StockDocument" ALTER COLUMN "accountingModel" TYPE "StockAccountingModel_new"
  USING ("accountingModel"::text::"StockAccountingModel_new");
ALTER TABLE "StockTransaction" ALTER COLUMN "accountingModel" TYPE "StockAccountingModel_new"
  USING ("accountingModel"::text::"StockAccountingModel_new");
DROP TYPE "StockAccountingModel";
ALTER TYPE "StockAccountingModel_new" RENAME TO "StockAccountingModel";

CREATE TYPE "StockTransactionType_new" AS ENUM (
  'INITIAL_BALANCE',
  'RECEIPT',
  'MANUAL_RECEIPT',
  'ADJUSTMENT_INCREASE',
  'ADJUSTMENT_DECREASE',
  'ISSUE_REVERSAL',
  'MVO_TRANSFER_OUT',
  'MVO_TRANSFER_REVERSAL',
  'ISSUE_OUT',
  'IMPORT_RECEIPT'
);
ALTER TABLE "StockTransaction" ALTER COLUMN "type" TYPE "StockTransactionType_new"
  USING ("type"::text::"StockTransactionType_new");
DROP TYPE "StockTransactionType";
ALTER TYPE "StockTransactionType_new" RENAME TO "StockTransactionType";

COMMIT;
