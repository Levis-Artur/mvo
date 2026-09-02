ALTER TABLE "StockDocument" DROP CONSTRAINT "StockDocument_createdByUserId_fkey";
ALTER TABLE "StockDocumentAttachment" DROP CONSTRAINT "StockDocumentAttachment_uploadedByUserId_fkey";
ALTER TABLE "IssueRealization" DROP CONSTRAINT "IssueRealization_createdByUserId_fkey";
ALTER TABLE "IssueRealizationAttachment" DROP CONSTRAINT "IssueRealizationAttachment_uploadedByUserId_fkey";
ALTER TABLE "AccountingTransferExportBatch" DROP CONSTRAINT "AccountingTransferExportBatch_createdByUserId_fkey";

ALTER TABLE "StockDocument" ALTER COLUMN "createdByUserId" DROP NOT NULL;
ALTER TABLE "StockDocumentAttachment" ALTER COLUMN "uploadedByUserId" DROP NOT NULL;
ALTER TABLE "IssueRealization" ALTER COLUMN "createdByUserId" DROP NOT NULL;
ALTER TABLE "IssueRealizationAttachment" ALTER COLUMN "uploadedByUserId" DROP NOT NULL;
ALTER TABLE "AccountingTransferExportBatch" ALTER COLUMN "createdByUserId" DROP NOT NULL;

ALTER TABLE "StockDocument"
  ADD CONSTRAINT "StockDocument_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockDocumentAttachment"
  ADD CONSTRAINT "StockDocumentAttachment_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IssueRealization"
  ADD CONSTRAINT "IssueRealization_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IssueRealizationAttachment"
  ADD CONSTRAINT "IssueRealizationAttachment_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingTransferExportBatch"
  ADD CONSTRAINT "AccountingTransferExportBatch_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
