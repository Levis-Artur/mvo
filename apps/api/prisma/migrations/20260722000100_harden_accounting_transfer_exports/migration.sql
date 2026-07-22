-- Harden MVO transfer export batches without deleting or rewriting stock data.
-- Existing batches and snapshots remain byte-for-byte compatible with the
-- legacy V1 renderer. No historical snapshot values or hashes are rewritten.

ALTER TABLE "StockDocument"
ADD COLUMN "exportedByUserId" UUID,
ADD COLUMN "exportedAt" TIMESTAMP(3);

CREATE INDEX "StockDocument_exportedByUserId_idx"
ON "StockDocument"("exportedByUserId");

CREATE INDEX "StockDocument_exportedAt_idx"
ON "StockDocument"("exportedAt");

ALTER TABLE "StockDocument"
ADD CONSTRAINT "StockDocument_exportedByUserId_fkey"
FOREIGN KEY ("exportedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingTransferExportRow"
ADD COLUMN "displayNumber" INTEGER;

-- Every pre-existing batch keeps the exact legacy V1 renderer. New batches
-- explicitly opt into V2 in application code.
ALTER TABLE "AccountingTransferExportBatch"
ADD COLUMN "formatVersion" INTEGER NOT NULL DEFAULT 1;

-- The ADD COLUMN statement assigns V1 to every existing batch. Future raw
-- inserts default to V2; application code also supplies V2 explicitly.
ALTER TABLE "AccountingTransferExportBatch"
ALTER COLUMN "formatVersion" SET DEFAULT 2;

ALTER TABLE "AccountingTransferExportBatch"
ADD CONSTRAINT "AccountingTransferExportBatch_formatVersion_check"
CHECK ("formatVersion" IN (1, 2));

ALTER TABLE "AccountingTransferExportRow"
ADD CONSTRAINT "AccountingTransferExportRow_displayNumber_positive_check"
CHECK ("displayNumber" IS NULL OR "displayNumber" > 0);
