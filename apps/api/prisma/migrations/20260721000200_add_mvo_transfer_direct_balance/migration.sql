-- Additive direct-balance transfer model.
-- Existing TRANSFER, ASSIGNMENT, ISSUE, custody balances, and transactions
-- remain unchanged and auditable.

ALTER TYPE "StockDocumentType" ADD VALUE 'MVO_TRANSFER';
ALTER TYPE "StockTransactionType" ADD VALUE 'MVO_TRANSFER_OUT';
ALTER TYPE "StockTransactionType" ADD VALUE 'MVO_TRANSFER_REVERSAL';
ALTER TYPE "StockTransactionType" ADD VALUE 'ISSUE_OUT';
ALTER TYPE "StockTransactionType" ADD VALUE 'IMPORT_RECEIPT';
ALTER TYPE "StockAccountingModel" ADD VALUE 'DIRECT_BALANCE';

ALTER TABLE "StockDocumentLine"
ADD COLUMN "sourceBalanceId" UUID,
ADD COLUMN "quantityBefore" DECIMAL(18,4),
ADD COLUMN "quantityAfter" DECIMAL(18,4);

CREATE INDEX "StockDocumentLine_sourceBalanceId_idx"
ON "StockDocumentLine"("sourceBalanceId");

ALTER TABLE "StockDocumentLine"
ADD CONSTRAINT "StockDocumentLine_sourceBalanceId_fkey"
FOREIGN KEY ("sourceBalanceId") REFERENCES "StockBalance"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
