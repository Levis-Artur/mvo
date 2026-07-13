CREATE TYPE "ImportType" AS ENUM ('INITIAL_BALANCE', 'RECEIPT');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'WARNING', 'ERROR', 'SKIPPED', 'IMPORTED');
CREATE TYPE "StockTransactionType" AS ENUM ('INITIAL_BALANCE', 'RECEIPT', 'MANUAL_RECEIPT', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE');
CREATE TYPE "InventoryItemReviewStatus" AS ENUM ('VERIFIED', 'NEEDS_REVIEW');

ALTER TABLE "ResponsiblePerson"
ADD COLUMN "externalAccountingName" TEXT,
ADD COLUMN "externalAccountingCode" TEXT;

CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "externalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitOfMeasure" TEXT,
    "category" TEXT,
    "description" TEXT,
    "reviewStatus" "InventoryItemReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdManually" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
    "id" UUID NOT NULL,
    "responsiblePersonId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "encoding" TEXT NOT NULL,
    "delimiter" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "counterpartyRaw" TEXT NOT NULL,
    "nomenclatureCodeRaw" TEXT NOT NULL,
    "itemNameRaw" TEXT NOT NULL,
    "unitOfMeasureRaw" TEXT,
    "debitQuantityRaw" TEXT,
    "endingQuantityRaw" TEXT,
    "parsedQuantity" DECIMAL(18,4),
    "responsiblePersonId" UUID,
    "inventoryItemId" UUID,
    "message" TEXT,
    "systemBalance" DECIMAL(18,4),
    "fileEndingBalance" DECIMAL(18,4),
    "balanceDifference" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockTransaction" (
    "id" UUID NOT NULL,
    "type" "StockTransactionType" NOT NULL,
    "responsiblePersonId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "balanceBefore" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "sourceDocument" TEXT,
    "importBatchId" UUID,
    "importRowId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResponsiblePerson_externalAccountingName_key" ON "ResponsiblePerson"("externalAccountingName");
CREATE INDEX "ResponsiblePerson_externalAccountingCode_idx" ON "ResponsiblePerson"("externalAccountingCode");

CREATE UNIQUE INDEX "InventoryItem_externalCode_key" ON "InventoryItem"("externalCode");
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItem_reviewStatus_idx" ON "InventoryItem"("reviewStatus");
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");

CREATE UNIQUE INDEX "StockBalance_responsiblePersonId_inventoryItemId_key" ON "StockBalance"("responsiblePersonId", "inventoryItemId");
CREATE INDEX "StockBalance_responsiblePersonId_idx" ON "StockBalance"("responsiblePersonId");
CREATE INDEX "StockBalance_inventoryItemId_idx" ON "StockBalance"("inventoryItemId");

CREATE UNIQUE INDEX "ImportBatch_fileHash_key" ON "ImportBatch"("fileHash");
CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

CREATE UNIQUE INDEX "ImportRow_importBatchId_rowNumber_key" ON "ImportRow"("importBatchId", "rowNumber");
CREATE INDEX "ImportRow_importBatchId_idx" ON "ImportRow"("importBatchId");
CREATE INDEX "ImportRow_status_idx" ON "ImportRow"("status");
CREATE INDEX "ImportRow_responsiblePersonId_idx" ON "ImportRow"("responsiblePersonId");
CREATE INDEX "ImportRow_inventoryItemId_idx" ON "ImportRow"("inventoryItemId");

CREATE UNIQUE INDEX "StockTransaction_importRowId_key" ON "StockTransaction"("importRowId");
CREATE INDEX "StockTransaction_responsiblePersonId_idx" ON "StockTransaction"("responsiblePersonId");
CREATE INDEX "StockTransaction_inventoryItemId_idx" ON "StockTransaction"("inventoryItemId");
CREATE INDEX "StockTransaction_type_idx" ON "StockTransaction"("type");
CREATE INDEX "StockTransaction_occurredAt_idx" ON "StockTransaction"("occurredAt");
CREATE INDEX "StockTransaction_importBatchId_idx" ON "StockTransaction"("importBatchId");

ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
