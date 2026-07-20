-- Additive foundation for owner/custody accounting.
-- Existing TRANSFER documents and StockTransaction rows remain unchanged and
-- are treated as legacy records because all new discriminator fields are NULL.

ALTER TYPE "UserRole" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "StockDocumentType" ADD VALUE 'ASSIGNMENT';

ALTER TYPE "StockTransactionType" ADD VALUE 'ASSIGNMENT_OUT_DIRECT';
ALTER TYPE "StockTransactionType" ADD VALUE 'ASSIGNMENT_OUT_CUSTODY';
ALTER TYPE "StockTransactionType" ADD VALUE 'ASSIGNMENT_IN_CUSTODY';
ALTER TYPE "StockTransactionType" ADD VALUE 'ISSUE_FROM_DIRECT';
ALTER TYPE "StockTransactionType" ADD VALUE 'ISSUE_FROM_CUSTODY';
ALTER TYPE "StockTransactionType" ADD VALUE 'ASSIGNMENT_REVERSAL';

CREATE TYPE "StockSourceKind" AS ENUM ('DIRECT', 'ASSIGNED');
CREATE TYPE "StockAccountingModel" AS ENUM ('LEGACY_BALANCE', 'OWNER_CUSTODY');

ALTER TABLE "StockDocument"
ADD COLUMN "accountingModel" "StockAccountingModel";

ALTER TABLE "StockDocumentLine"
ADD COLUMN "sourceKind" "StockSourceKind",
ADD COLUMN "accountingOwnerResponsiblePersonId" UUID,
ADD COLUMN "sourceCustodianResponsiblePersonId" UUID,
ADD COLUMN "sourceCustodyBalanceId" UUID;

ALTER TABLE "StockTransaction"
ADD COLUMN "accountingModel" "StockAccountingModel",
ADD COLUMN "bucketKind" "StockSourceKind",
ADD COLUMN "accountingOwnerResponsiblePersonId" UUID,
ADD COLUMN "sourceCustodianResponsiblePersonId" UUID,
ADD COLUMN "destinationCustodianResponsiblePersonId" UUID,
ADD COLUMN "reversalOfTransactionId" UUID;

CREATE TABLE "CustodyBalance" (
    "id" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "accountingOwnerResponsiblePersonId" UUID NOT NULL,
    "custodianResponsiblePersonId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustodyBalance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustodyBalance_quantity_nonnegative_check" CHECK ("quantity" >= 0),
    CONSTRAINT "CustodyBalance_owner_differs_from_custodian_check"
      CHECK ("accountingOwnerResponsiblePersonId" <> "custodianResponsiblePersonId")
);

CREATE TABLE "StockDocumentAttachment" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockDocumentAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockDocumentAttachment_size_nonnegative_check" CHECK ("sizeBytes" >= 0)
);

ALTER TABLE "StockBalance"
ADD CONSTRAINT "StockBalance_quantity_nonnegative_check"
CHECK ("quantity" >= 0) NOT VALID;

ALTER TABLE "StockBalance"
VALIDATE CONSTRAINT "StockBalance_quantity_nonnegative_check";

DROP INDEX "StockDocumentLine_documentId_inventoryItemId_key";

CREATE UNIQUE INDEX "CustodyBalance_inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId_key"
ON "CustodyBalance"("inventoryItemId", "accountingOwnerResponsiblePersonId", "custodianResponsiblePersonId");
CREATE INDEX "CustodyBalance_inventoryItemId_idx" ON "CustodyBalance"("inventoryItemId");
CREATE INDEX "CustodyBalance_accountingOwnerResponsiblePersonId_idx" ON "CustodyBalance"("accountingOwnerResponsiblePersonId");
CREATE INDEX "CustodyBalance_custodianResponsiblePersonId_idx" ON "CustodyBalance"("custodianResponsiblePersonId");
CREATE INDEX "CustodyBalance_accountingOwnerResponsiblePersonId_inventoryItemId_idx"
ON "CustodyBalance"("accountingOwnerResponsiblePersonId", "inventoryItemId");
CREATE INDEX "CustodyBalance_custodianResponsiblePersonId_inventoryItemId_idx"
ON "CustodyBalance"("custodianResponsiblePersonId", "inventoryItemId");

CREATE UNIQUE INDEX "StockDocumentLine_legacy_document_item_key"
ON "StockDocumentLine"("documentId", "inventoryItemId")
WHERE "accountingOwnerResponsiblePersonId" IS NULL;
CREATE UNIQUE INDEX "StockDocumentLine_owner_document_item_key"
ON "StockDocumentLine"("documentId", "inventoryItemId", "accountingOwnerResponsiblePersonId")
WHERE "accountingOwnerResponsiblePersonId" IS NOT NULL;
CREATE INDEX "StockDocumentLine_accountingOwnerResponsiblePersonId_idx"
ON "StockDocumentLine"("accountingOwnerResponsiblePersonId");
CREATE INDEX "StockDocumentLine_sourceCustodianResponsiblePersonId_idx"
ON "StockDocumentLine"("sourceCustodianResponsiblePersonId");
CREATE INDEX "StockDocumentLine_sourceCustodyBalanceId_idx"
ON "StockDocumentLine"("sourceCustodyBalanceId");

CREATE UNIQUE INDEX "StockTransaction_reversalOfTransactionId_key"
ON "StockTransaction"("reversalOfTransactionId");
CREATE INDEX "StockTransaction_accountingOwnerResponsiblePersonId_idx"
ON "StockTransaction"("accountingOwnerResponsiblePersonId");
CREATE INDEX "StockTransaction_sourceCustodianResponsiblePersonId_idx"
ON "StockTransaction"("sourceCustodianResponsiblePersonId");
CREATE INDEX "StockTransaction_destinationCustodianResponsiblePersonId_idx"
ON "StockTransaction"("destinationCustodianResponsiblePersonId");
CREATE INDEX "StockTransaction_accountingModel_idx" ON "StockTransaction"("accountingModel");
CREATE INDEX "StockTransaction_bucketKind_idx" ON "StockTransaction"("bucketKind");

CREATE INDEX "StockDocument_accountingModel_idx" ON "StockDocument"("accountingModel");
CREATE INDEX IF NOT EXISTS "StockDocument_status_idx" ON "StockDocument"("status");
CREATE INDEX IF NOT EXISTS "StockDocument_documentDate_idx" ON "StockDocument"("documentDate");
CREATE INDEX IF NOT EXISTS "StockDocumentLine_documentId_idx" ON "StockDocumentLine"("documentId");
CREATE INDEX IF NOT EXISTS "StockTransaction_documentId_idx" ON "StockTransaction"("documentId");

CREATE UNIQUE INDEX "StockDocumentAttachment_storedFileName_key"
ON "StockDocumentAttachment"("storedFileName");
CREATE INDEX "StockDocumentAttachment_documentId_idx" ON "StockDocumentAttachment"("documentId");
CREATE INDEX "StockDocumentAttachment_uploadedByUserId_idx" ON "StockDocumentAttachment"("uploadedByUserId");
CREATE INDEX "StockDocumentAttachment_sha256_idx" ON "StockDocumentAttachment"("sha256");

ALTER TABLE "CustodyBalance"
ADD CONSTRAINT "CustodyBalance_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyBalance"
ADD CONSTRAINT "CustodyBalance_accountingOwnerResponsiblePersonId_fkey"
FOREIGN KEY ("accountingOwnerResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyBalance"
ADD CONSTRAINT "CustodyBalance_custodianResponsiblePersonId_fkey"
FOREIGN KEY ("custodianResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockDocumentLine"
ADD CONSTRAINT "StockDocumentLine_accountingOwnerResponsiblePersonId_fkey"
FOREIGN KEY ("accountingOwnerResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocumentLine"
ADD CONSTRAINT "StockDocumentLine_sourceCustodianResponsiblePersonId_fkey"
FOREIGN KEY ("sourceCustodianResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocumentLine"
ADD CONSTRAINT "StockDocumentLine_sourceCustodyBalanceId_fkey"
FOREIGN KEY ("sourceCustodyBalanceId") REFERENCES "CustodyBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransaction"
ADD CONSTRAINT "StockTransaction_accountingOwnerResponsiblePersonId_fkey"
FOREIGN KEY ("accountingOwnerResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction"
ADD CONSTRAINT "StockTransaction_sourceCustodianResponsiblePersonId_fkey"
FOREIGN KEY ("sourceCustodianResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction"
ADD CONSTRAINT "StockTransaction_destinationCustodianResponsiblePersonId_fkey"
FOREIGN KEY ("destinationCustodianResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction"
ADD CONSTRAINT "StockTransaction_reversalOfTransactionId_fkey"
FOREIGN KEY ("reversalOfTransactionId") REFERENCES "StockTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockDocumentAttachment"
ADD CONSTRAINT "StockDocumentAttachment_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocumentAttachment"
ADD CONSTRAINT "StockDocumentAttachment_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
