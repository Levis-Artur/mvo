DROP INDEX IF EXISTS "ResponsiblePerson_personnelNumber_idx";
DROP INDEX IF EXISTS "ResponsiblePerson_personnelNumber_key";
ALTER TABLE "AccountingTransferExportRow"
  ADD COLUMN "sourceAccountingCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "destinationAccountingCode" TEXT NOT NULL DEFAULT '';

UPDATE "AccountingTransferExportRow" AS export_row
SET "sourceAccountingCode" = person."externalAccountingCode"
FROM "StockDocument" AS document
JOIN "ResponsiblePerson" AS person
  ON person."id" = document."sourceResponsiblePersonId"
WHERE export_row."documentId" = document."id"
  AND person."externalAccountingCode" IS NOT NULL;

UPDATE "AccountingTransferExportRow" AS export_row
SET "destinationAccountingCode" = person."externalAccountingCode"
FROM "StockDocument" AS document
JOIN "ResponsiblePerson" AS person
  ON person."id" = document."destinationResponsiblePersonId"
WHERE export_row."documentId" = document."id"
  AND person."externalAccountingCode" IS NOT NULL;

ALTER TABLE "AccountingTransferExportRow"
  ALTER COLUMN "sourceAccountingCode" DROP DEFAULT,
  ALTER COLUMN "destinationAccountingCode" DROP DEFAULT,
  DROP COLUMN "sourcePersonnelNumber",
  DROP COLUMN "destinationPersonnelNumber";
ALTER TABLE "ResponsiblePerson"
  ALTER COLUMN "externalAccountingCode" SET NOT NULL,
  DROP COLUMN "personnelNumber";
