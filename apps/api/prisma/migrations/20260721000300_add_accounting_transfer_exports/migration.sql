-- Add an accounting export ledger for MVO_TRANSFER documents.
-- Exporting is informational only: this migration does not alter stock balances,
-- import records, legacy TRANSFER/ASSIGNMENT documents, or their transactions.

CREATE TYPE "AccountingExportState" AS ENUM ('NOT_EXPORTED', 'EXPORTED');

ALTER TABLE "StockDocument"
ADD COLUMN "accountingExportState" "AccountingExportState" NOT NULL DEFAULT 'NOT_EXPORTED';

CREATE INDEX "StockDocument_accountingExportState_idx"
ON "StockDocument"("accountingExportState");

CREATE TABLE "AccountingTransferExportBatch" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "documentCount" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingTransferExportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingTransferExportBatchDocument" (
    "batchId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    CONSTRAINT "AccountingTransferExportBatchDocument_pkey" PRIMARY KEY ("batchId", "documentId")
);

CREATE TABLE "AccountingTransferExportRow" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentLineId" UUID NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "sourcePersonnelNumber" TEXT NOT NULL,
    "sourceFullName" TEXT NOT NULL,
    "sourceManagementName" TEXT NOT NULL,
    "destinationPersonnelNumber" TEXT NOT NULL,
    "destinationFullName" TEXT NOT NULL,
    "destinationManagementName" TEXT NOT NULL,
    "inventoryCode" TEXT NOT NULL,
    "inventoryName" TEXT NOT NULL,
    "unitOfMeasure" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "documentStatus" "StockDocumentStatus" NOT NULL,
    "postedAt" TIMESTAMP(3),
    "rowOrder" INTEGER NOT NULL,
    CONSTRAINT "AccountingTransferExportRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountingTransferExportBatch_createdByUserId_idx"
ON "AccountingTransferExportBatch"("createdByUserId");
CREATE INDEX "AccountingTransferExportBatch_createdAt_idx"
ON "AccountingTransferExportBatch"("createdAt");
CREATE INDEX "AccountingTransferExportBatchDocument_documentId_idx"
ON "AccountingTransferExportBatchDocument"("documentId");
CREATE UNIQUE INDEX "AccountingTransferExportRow_batchId_rowOrder_key"
ON "AccountingTransferExportRow"("batchId", "rowOrder");
CREATE INDEX "AccountingTransferExportRow_batchId_idx"
ON "AccountingTransferExportRow"("batchId");
CREATE INDEX "AccountingTransferExportRow_documentId_idx"
ON "AccountingTransferExportRow"("documentId");

ALTER TABLE "AccountingTransferExportBatch"
ADD CONSTRAINT "AccountingTransferExportBatch_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingTransferExportBatchDocument"
ADD CONSTRAINT "AccountingTransferExportBatchDocument_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "AccountingTransferExportBatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingTransferExportBatchDocument"
ADD CONSTRAINT "AccountingTransferExportBatchDocument_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingTransferExportRow"
ADD CONSTRAINT "AccountingTransferExportRow_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "AccountingTransferExportBatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
