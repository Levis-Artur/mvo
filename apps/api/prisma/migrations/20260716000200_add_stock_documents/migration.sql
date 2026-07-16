CREATE TYPE "StockDocumentType" AS ENUM ('TRANSFER', 'ISSUE');
CREATE TYPE "StockDocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

ALTER TYPE "StockTransactionType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockTransactionType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockTransactionType" ADD VALUE 'ISSUE';
ALTER TYPE "StockTransactionType" ADD VALUE 'TRANSFER_REVERSAL_OUT';
ALTER TYPE "StockTransactionType" ADD VALUE 'TRANSFER_REVERSAL_IN';
ALTER TYPE "StockTransactionType" ADD VALUE 'ISSUE_REVERSAL';
ALTER TYPE "SecurityEventType" ADD VALUE 'STOCK_DOCUMENT_ACTION';

CREATE TABLE "StockDocument" (
  "id" UUID NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "type" "StockDocumentType" NOT NULL,
  "status" "StockDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceResponsiblePersonId" UUID NOT NULL,
  "destinationResponsiblePersonId" UUID,
  "recipientName" TEXT,
  "recipientUnit" TEXT,
  "basis" TEXT,
  "note" TEXT,
  "createdByUserId" UUID NOT NULL,
  "postedByUserId" UUID,
  "postedAt" TIMESTAMP(3),
  "cancelledByUserId" UUID,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockDocumentLine" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "inventoryItemId" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockDocumentLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockTransaction" ADD COLUMN "documentId" UUID;
ALTER TABLE "StockTransaction" ADD COLUMN "documentLineId" UUID;

CREATE UNIQUE INDEX "StockDocument_documentNumber_key" ON "StockDocument"("documentNumber");
CREATE INDEX "StockDocument_type_idx" ON "StockDocument"("type");
CREATE INDEX "StockDocument_status_idx" ON "StockDocument"("status");
CREATE INDEX "StockDocument_documentDate_idx" ON "StockDocument"("documentDate");
CREATE INDEX "StockDocument_sourceResponsiblePersonId_idx" ON "StockDocument"("sourceResponsiblePersonId");
CREATE INDEX "StockDocument_destinationResponsiblePersonId_idx" ON "StockDocument"("destinationResponsiblePersonId");
CREATE INDEX "StockDocument_createdByUserId_idx" ON "StockDocument"("createdByUserId");
CREATE UNIQUE INDEX "StockDocumentLine_documentId_inventoryItemId_key" ON "StockDocumentLine"("documentId", "inventoryItemId");
CREATE INDEX "StockDocumentLine_documentId_idx" ON "StockDocumentLine"("documentId");
CREATE INDEX "StockDocumentLine_inventoryItemId_idx" ON "StockDocumentLine"("inventoryItemId");
CREATE INDEX "StockTransaction_documentId_idx" ON "StockTransaction"("documentId");
CREATE INDEX "StockTransaction_documentLineId_idx" ON "StockTransaction"("documentLineId");

ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_sourceResponsiblePersonId_fkey" FOREIGN KEY ("sourceResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_destinationResponsiblePersonId_fkey" FOREIGN KEY ("destinationResponsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_documentLineId_fkey" FOREIGN KEY ("documentLineId") REFERENCES "StockDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
