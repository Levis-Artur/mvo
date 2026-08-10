-- New ISSUE documents reference the outgoing MVO_TRANSFER that they document.
-- Both columns remain nullable so legacy standalone ISSUE records stay readable.
ALTER TABLE "StockDocument"
ADD COLUMN "sourceTransferId" UUID;

ALTER TABLE "StockDocumentLine"
ADD COLUMN "sourceTransferLineId" UUID;

CREATE INDEX "StockDocument_sourceTransferId_idx"
ON "StockDocument"("sourceTransferId");

CREATE INDEX "StockDocumentLine_sourceTransferLineId_idx"
ON "StockDocumentLine"("sourceTransferLineId");

ALTER TABLE "StockDocument"
ADD CONSTRAINT "StockDocument_sourceTransferId_fkey"
FOREIGN KEY ("sourceTransferId") REFERENCES "StockDocument"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockDocumentLine"
ADD CONSTRAINT "StockDocumentLine_sourceTransferLineId_fkey"
FOREIGN KEY ("sourceTransferLineId") REFERENCES "StockDocumentLine"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
